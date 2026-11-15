"use client"

import { useEffect, useRef, useState } from "react"
import * as d3 from "d3"
import { EonetEvent, formatCompactCoords, getCategoryColor } from "@/src/utils/eonet"

interface RotatingEarthProps {
  width?: number
  height?: number
  className?: string
  events?: EonetEvent[]
  selectedEvent?: EonetEvent | null
  onSelectEvent?: (event: EonetEvent) => void
}

interface ProjectedPin {
  event: EonetEvent
  x: number
  y: number
}

interface FlyToAnimation {
  startTime: number
  duration: number
  interpolator: (t: number) => [number, number]
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "")
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export default function RotatingEarth({
  width = 760,
  height = 640,
  className = "",
  events = [],
  selectedEvent = null,
  onSelectEvent,
}: RotatingEarthProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const eventsRef = useRef<EonetEvent[]>(events)
  const selectedEventRef = useRef<EonetEvent | null>(selectedEvent)
  const onSelectEventRef = useRef(onSelectEvent)

  const rotationRef = useRef<[number, number]>([-20, -15])
  const autoRotateRef = useRef<boolean>(true)
  const flyToRef = useRef<FlyToAnimation | null>(null)
  const projectedPinsRef = useRef<ProjectedPin[]>([])
  const renderFnRef = useRef<(() => void) | null>(null)

  eventsRef.current = events
  selectedEventRef.current = selectedEvent
  onSelectEventRef.current = onSelectEvent

  // Smooth camera fly-to whenever selectedEvent changes
  useEffect(() => {
    if (!selectedEvent) return
    const [targetLng, targetLat] = selectedEvent.coordinates
    if (!Number.isFinite(targetLng) || !Number.isFinite(targetLat)) return

    autoRotateRef.current = false

    const current = rotationRef.current
    const curLng = (((current[0] % 360) + 540) % 360) - 180
    const targetRotLng = (((-targetLng % 360) + 540) % 360) - 180
    const shortestDelta = ((targetRotLng - curLng + 540) % 360) - 180
    const startRot: [number, number] = [curLng, current[1]]
    const endRot: [number, number] = [curLng + shortestDelta, Math.max(-85, Math.min(85, -targetLat))]

    flyToRef.current = {
      startTime: performance.now(),
      duration: 900,
      interpolator: d3.interpolate(startRot, endRot),
    }

    renderFnRef.current?.()
  }, [selectedEvent?.id, selectedEvent?.coordinates[0], selectedEvent?.coordinates[1]])

  useEffect(() => {
    renderFnRef.current?.()
  }, [events])

  useEffect(() => {
    if (!canvasRef.current) return

    const canvas = canvasRef.current
    const context = canvas.getContext("2d")
    if (!context) return

    const computeDimensions = () => {
      const parentWidth = containerRef.current?.parentElement?.clientWidth ?? window.innerWidth
      const availableW = Math.max(240, Math.min(width, parentWidth - 16, window.innerWidth - 32))
      const availableH = Math.max(
        240,
        Math.min(height, window.innerHeight - 150, Math.round(availableW * 1.0)),
      )
      const nextWidth = availableW
      const nextHeight = availableH
      const nextRadius = Math.min(nextWidth, nextHeight) / 2.38
      return { nextWidth, nextHeight, nextRadius }
    }

    let { nextWidth: containerWidth, nextHeight: containerHeight, nextRadius: radius } = computeDimensions()

    const applyCanvasSize = (w: number, h: number) => {
      const dpr = window.devicePixelRatio || 1
      canvas.width = w * dpr
      canvas.height = h * dpr
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    applyCanvasSize(containerWidth, containerHeight)

    const projection = d3
      .geoOrthographic()
      .scale(radius)
      .translate([containerWidth / 2, containerHeight / 2])
      .clipAngle(90)
      .rotate(rotationRef.current)

    const path = d3.geoPath().projection(projection).context(context)

    const pointInPolygon = (point: [number, number], polygon: number[][]): boolean => {
      const [x, y] = point
      let inside = false

      for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i]
        const [xj, yj] = polygon[j]

        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
          inside = !inside
        }
      }

      return inside
    }

    const pointInFeature = (point: [number, number], feature: any): boolean => {
      const geometry = feature.geometry

      if (geometry.type === "Polygon") {
        const coordinates = geometry.coordinates
        if (!pointInPolygon(point, coordinates[0])) {
          return false
        }
        for (let i = 1; i < coordinates.length; i++) {
          if (pointInPolygon(point, coordinates[i])) {
            return false
          }
        }
        return true
      } else if (geometry.type === "MultiPolygon") {
        for (const polygon of geometry.coordinates) {
          if (pointInPolygon(point, polygon[0])) {
            let inHole = false
            for (let i = 1; i < polygon.length; i++) {
              if (pointInPolygon(point, polygon[i])) {
                inHole = true
                break
              }
            }
            if (!inHole) {
              return true
            }
          }
        }
        return false
      }

      return false
    }

    const generateDotsInPolygon = (feature: any, dotSpacing = 16) => {
      const dots: [number, number][] = []
      const bounds = d3.geoBounds(feature)
      const [[minLng, minLat], [maxLng, maxLat]] = bounds

      const stepSize = dotSpacing * 0.08
      for (let lng = minLng; lng <= maxLng; lng += stepSize) {
        for (let lat = minLat; lat <= maxLat; lat += stepSize) {
          const point: [number, number] = [lng, lat]
          if (pointInFeature(point, feature)) {
            dots.push(point)
          }
        }
      }

      return dots
    }

    interface DotData {
      lng: number
      lat: number
    }

    const allDots: DotData[] = []
    let landFeatures: any
    const graticuleGeo = d3.geoGraticule()()

    const staticCanvas = document.createElement("canvas")
    const staticCtx = staticCanvas.getContext("2d")
    const staticPath = staticCtx ? d3.geoPath().projection(projection).context(staticCtx) : null
    let lastStaticKey = ""

    const drawEventPin = (
      ev: EonetEvent,
      px: number,
      py: number,
      isSelected: boolean,
      nowMs: number,
    ) => {
      const color = getCategoryColor(ev.categoryId)
      const baseRadius = isSelected ? 5.5 : 4.0

      // Outer atmospheric glow halo
      context.beginPath()
      context.arc(px, py, isSelected ? 15 : 10, 0, 2 * Math.PI)
      context.fillStyle = hexToRgba(color, isSelected ? 0.28 : 0.22)
      context.fill()

      // Animated pulsing ring for the selected event
      if (isSelected) {
        const pulse = (nowMs % 1600) / 1600
        const pulseRadius = 8 + pulse * 16
        const pulseAlpha = (1 - pulse) * 0.85

        context.beginPath()
        context.arc(px, py, pulseRadius, 0, 2 * Math.PI)
        context.strokeStyle = hexToRgba(color, pulseAlpha)
        context.lineWidth = 1.6
        context.stroke()

        context.beginPath()
        context.arc(px, py, 8.5, 0, 2 * Math.PI)
        context.strokeStyle = hexToRgba(color, 0.75)
        context.lineWidth = 1.2
        context.stroke()
      }

      // Marker core dot
      context.beginPath()
      context.arc(px, py, baseRadius, 0, 2 * Math.PI)
      context.fillStyle = color
      context.fill()

      context.lineWidth = isSelected ? 1.8 : 1.1
      context.strokeStyle = "#FFFFFF"
      context.stroke()
    }

    const drawSelectedBadge = (ev: EonetEvent, px: number, py: number) => {
      const color = getCategoryColor(ev.categoryId)
      const label = `${ev.id} • ${formatCompactCoords(ev.coordinates)}`

      context.save()
      context.font = '500 11px "JetBrains Mono", ui-monospace, monospace'
      const textWidth = context.measureText(label).width
      const padX = 10
      const badgeH = 24
      const badgeW = Math.min(containerWidth - 16, textWidth + padX * 2 + 12)

      let bx: number
      let by: number

      const fitsRight = px + 14 + badgeW <= containerWidth - 8
      const fitsLeft = px - 14 - badgeW >= 8

      if (containerWidth >= 460 && (fitsRight || fitsLeft)) {
        bx = fitsRight ? px + 14 : px - badgeW - 14
        by = Math.max(8, Math.min(containerHeight - badgeH - 8, py - badgeH / 2))
      } else {
        // Place centered cleanly above (or below) the pin so the badge never covers the pulsing marker
        bx = Math.max(8, Math.min(containerWidth - badgeW - 8, px - badgeW / 2))
        by = py > badgeH + 28 ? py - badgeH - 18 : Math.min(containerHeight - badgeH - 8, py + 18)
      }

      const r = 6
      context.beginPath()
      context.moveTo(bx + r, by)
      context.lineTo(bx + badgeW - r, by)
      context.quadraticCurveTo(bx + badgeW, by, bx + badgeW, by + r)
      context.lineTo(bx + badgeW, by + badgeH - r)
      context.quadraticCurveTo(bx + badgeW, by + badgeH, bx + badgeW - r, by + badgeH)
      context.lineTo(bx + r, by + badgeH)
      context.quadraticCurveTo(bx, by + badgeH, bx, by + badgeH - r)
      context.lineTo(bx, by + r)
      context.quadraticCurveTo(bx, by, bx + r, by)
      context.closePath()

      context.fillStyle = "rgba(18, 20, 24, 0.94)"
      context.fill()
      context.strokeStyle = hexToRgba(color, 0.65)
      context.lineWidth = 1
      context.stroke()

      context.beginPath()
      context.arc(bx + 10, by + badgeH / 2, 3, 0, 2 * Math.PI)
      context.fillStyle = color
      context.fill()

      context.fillStyle = "#F8FAFC"
      context.textBaseline = "middle"
      context.fillText(label, bx + 18, by + badgeH / 2 + 0.5)
      context.restore()
    }

    const renderStaticGlobe = (targetCtx: CanvasRenderingContext2D, targetPath: d3.GeoPath<any, d3.GeoPermissibleObjects>) => {
      const currentScale = projection.scale()
      const scaleFactor = currentScale / radius
      const dotRadius = 1.2 * scaleFactor

      targetCtx.clearRect(0, 0, containerWidth, containerHeight)

      // Draw ocean (globe background)
      targetCtx.beginPath()
      targetCtx.arc(containerWidth / 2, containerHeight / 2, currentScale, 0, 2 * Math.PI)
      targetCtx.fillStyle = "#000000"
      targetCtx.fill()
      targetCtx.strokeStyle = "rgba(255, 255, 255, 0.85)"
      targetCtx.lineWidth = 1.8 * scaleFactor
      targetCtx.stroke()

      if (landFeatures) {
        // Draw graticule
        targetCtx.beginPath()
        targetPath(graticuleGeo)
        targetCtx.strokeStyle = "#ffffff"
        targetCtx.lineWidth = 0.85 * scaleFactor
        targetCtx.globalAlpha = 0.2
        targetCtx.stroke()
        targetCtx.globalAlpha = 1

        // Draw land outlines
        targetCtx.beginPath()
        targetPath(landFeatures)
        targetCtx.strokeStyle = "rgba(255, 255, 255, 0.82)"
        targetCtx.lineWidth = 0.9 * scaleFactor
        targetCtx.stroke()

        // Draw halftone dots in a single batched path
        targetCtx.beginPath()
        for (let i = 0; i < allDots.length; i++) {
          const dot = allDots[i]
          const projected = projection([dot.lng, dot.lat])
          if (
            projected &&
            projected[0] >= 0 &&
            projected[0] <= containerWidth &&
            projected[1] >= 0 &&
            projected[1] <= containerHeight
          ) {
            targetCtx.moveTo(projected[0] + dotRadius, projected[1])
            targetCtx.arc(projected[0], projected[1], dotRadius, 0, 2 * Math.PI)
          }
        }
        targetCtx.fillStyle = "#8B93A1"
        targetCtx.fill()
      }
    }

    const render = () => {
      const nowMs = performance.now()
      const dpr = window.devicePixelRatio || 1
      const currentScale = projection.scale()
      const rot = rotationRef.current
      const staticKey = `${containerWidth}:${containerHeight}:${dpr}:${currentScale.toFixed(2)}:${rot[0].toFixed(3)}:${rot[1].toFixed(3)}:${landFeatures ? 1 : 0}`

      if (staticCtx && staticPath) {
        if (staticKey !== lastStaticKey) {
          if (staticCanvas.width !== canvas.width || staticCanvas.height !== canvas.height) {
            staticCanvas.width = canvas.width
            staticCanvas.height = canvas.height
          }
          staticCtx.setTransform(dpr, 0, 0, dpr, 0, 0)
          renderStaticGlobe(staticCtx, staticPath)
          lastStaticKey = staticKey
        }
        context.clearRect(0, 0, containerWidth, containerHeight)
        context.drawImage(staticCanvas, 0, 0, containerWidth, containerHeight)
      } else {
        renderStaticGlobe(context, path)
      }

      // Render live NASA EONET pins on the visible front hemisphere
      const centerGeo: [number, number] = [-rot[0], -rot[1]]
      const activeSelected = selectedEventRef.current
      const nextProjectedPins: ProjectedPin[] = []
      let selectedScreenPos: { event: EonetEvent; x: number; y: number } | null = null

      const currentEvents = eventsRef.current
      for (let i = 0; i < currentEvents.length; i++) {
        const ev = currentEvents[i]
        const dist = d3.geoDistance(ev.coordinates, centerGeo)
        if (dist >= Math.PI / 2) continue

        const projected = projection(ev.coordinates)
        if (!projected) continue

        const [px, py] = projected
        if (!Number.isFinite(px) || !Number.isFinite(py)) continue

        nextProjectedPins.push({ event: ev, x: px, y: py })

        if (activeSelected && ev.id === activeSelected.id) {
          selectedScreenPos = { event: ev, x: px, y: py }
        } else {
          drawEventPin(ev, px, py, false, nowMs)
        }
      }

      if (selectedScreenPos) {
        drawEventPin(
          selectedScreenPos.event,
          selectedScreenPos.x,
          selectedScreenPos.y,
          true,
          nowMs,
        )
        drawSelectedBadge(selectedScreenPos.event, selectedScreenPos.x, selectedScreenPos.y)
      }

      projectedPinsRef.current = nextProjectedPins
    }

    renderFnRef.current = render

    const loadWorldData = async () => {
      try {
        setIsLoading(true)

        const response = await fetch(
          "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json",
        )
        if (!response.ok) throw new Error("Failed to load land data")

        landFeatures = await response.json()

        landFeatures.features.forEach((feature: any) => {
          const dots = generateDotsInPolygon(feature, 16)
          dots.forEach(([lng, lat]) => {
            allDots.push({ lng, lat })
          })
        })

        render()
        setIsLoading(false)
      } catch {
        setError("Failed to load land map data")
        setIsLoading(false)
      }
    }

    let lastPulseFrame = 0

    const tick = () => {
      const now = performance.now()
      const fly = flyToRef.current

      if (fly) {
        const elapsed = now - fly.startTime
        const t = Math.min(1, elapsed / fly.duration)
        const eased = d3.easeCubicInOut(t)
        const nextRot = fly.interpolator(eased)
        rotationRef.current = [nextRot[0], nextRot[1]]
        projection.rotate(rotationRef.current)
        render()
        if (t >= 1) {
          flyToRef.current = null
        }
        return
      }

      if (autoRotateRef.current) {
        rotationRef.current[0] += 0.35
        projection.rotate(rotationRef.current)
        render()
        return
      }

      // Subtle pulsing ring refresh for selected pin (~24fps) without overhead
      if (selectedEventRef.current && now - lastPulseFrame >= 40) {
        lastPulseFrame = now
        render()
      }
    }

    const rotationTimer = d3.timer(tick)

    let isDragging = false

    const findPinAtPoint = (x: number, y: number): ProjectedPin | null => {
      let closest: ProjectedPin | null = null
      let minDist = 14

      const pins = projectedPinsRef.current
      for (let i = 0; i < pins.length; i++) {
        const pin = pins[i]
        const dist = Math.hypot(pin.x - x, pin.y - y)
        if (dist <= minDist) {
          minDist = dist
          closest = pin
        }
      }
      return closest
    }

    const handleMouseDown = (event: MouseEvent) => {
      flyToRef.current = null
      isDragging = true
      const wasAutoRotating = autoRotateRef.current
      autoRotateRef.current = false

      const startX = event.clientX
      const startY = event.clientY
      const startRotation: [number, number] = [...rotationRef.current]
      let moved = false

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const dx = moveEvent.clientX - startX
        const dy = moveEvent.clientY - startY
        if (Math.hypot(dx, dy) > 4) {
          moved = true
        }

        const sensitivity = 0.48
        rotationRef.current[0] = startRotation[0] + dx * sensitivity
        rotationRef.current[1] = Math.max(-85, Math.min(85, startRotation[1] - dy * sensitivity))

        projection.rotate(rotationRef.current)
        render()
      }

      const handleMouseUp = (upEvent: MouseEvent) => {
        isDragging = false
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)

        if (!moved) {
          const rect = canvas.getBoundingClientRect()
          const cx = upEvent.clientX - rect.left
          const cy = upEvent.clientY - rect.top
          const hit = findPinAtPoint(cx, cy)
          if (hit) {
            onSelectEventRef.current?.(hit.event)
            return
          }
        }

        if (wasAutoRotating && !selectedEventRef.current) {
          setTimeout(() => {
            autoRotateRef.current = true
          }, 15)
        }
      }

      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
    }

    const handleCanvasMouseMove = (event: MouseEvent) => {
      if (isDragging) return
      const rect = canvas.getBoundingClientRect()
      const cx = event.clientX - rect.left
      const cy = event.clientY - rect.top
      const hit = findPinAtPoint(cx, cy)
      canvas.style.cursor = hit ? "pointer" : "grab"
    }

    const handleWheel = (event: WheelEvent) => {
      event.preventDefault()
      const scaleFactor = event.deltaY > 0 ? 0.92 : 1.09
      const newRadius = Math.max(radius * 0.55, Math.min(radius * 2.8, projection.scale() * scaleFactor))
      projection.scale(newRadius)
      render()
    }

    const handleResize = () => {
      const zoomRatio = radius > 0 ? projection.scale() / radius : 1
      const next = computeDimensions()
      containerWidth = next.nextWidth
      containerHeight = next.nextHeight
      radius = next.nextRadius
      applyCanvasSize(containerWidth, containerHeight)
      projection.scale(radius * zoomRatio).translate([containerWidth / 2, containerHeight / 2])
      render()
    }

    const resizeObserver =
      typeof ResizeObserver !== "undefined" && containerRef.current?.parentElement
        ? new ResizeObserver(() => handleResize())
        : null

    if (resizeObserver && containerRef.current?.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement)
    }

    canvas.addEventListener("mousedown", handleMouseDown)
    canvas.addEventListener("mousemove", handleCanvasMouseMove)
    canvas.addEventListener("wheel", handleWheel, { passive: false })
    window.addEventListener("resize", handleResize)

    loadWorldData()

    return () => {
      renderFnRef.current = null
      rotationTimer.stop()
      resizeObserver?.disconnect()
      canvas.removeEventListener("mousedown", handleMouseDown)
      canvas.removeEventListener("mousemove", handleCanvasMouseMove)
      canvas.removeEventListener("wheel", handleWheel)
      window.removeEventListener("resize", handleResize)
    }
  }, [width, height])

  if (error) {
    return (
      <div className={`dark flex items-center justify-center bg-[#121418]/90 border border-white/10 rounded-2xl p-8 ${className}`}>
        <div className="text-center">
          <p className="text-red-400 font-semibold mb-2">Error loading Earth visualization</p>
          <p className="text-zinc-400 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      data-testid="orbisys-globe"
      data-selected-event-id={selectedEvent?.id ?? ""}
      data-pin-count={events.length}
      className={`relative inline-flex items-center justify-center ${className}`}
    >
      <canvas
        ref={canvasRef}
        aria-label="Interactive Orbisys Earth Observation Globe"
        className="block rounded-2xl bg-transparent cursor-grab active:cursor-grabbing"
      />
    </div>
  )
}
