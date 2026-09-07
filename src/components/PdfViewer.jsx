import { useState, useRef, useEffect, useCallback } from 'react'
import { Document, Page, pdfjs } from 'react-pdf'

import 'react-pdf/dist/Page/AnnotationLayer.css'
import 'react-pdf/dist/Page/TextLayer.css'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const MAX_PAGE_WIDTH = 700
const MIN_SIG_SIZE = 40
const DEFAULT_SIG_WIDTH = 150

function PdfViewer({ documentId, signature, onPositionChange }) {

  const [numPages, setNumPages] = useState(null)
  const [renderWidth, setRenderWidth] = useState(MAX_PAGE_WIDTH)
  const [pageOriginalWidth, setPageOriginalWidth] = useState(null)
  const [pageOriginalHeight, setPageOriginalHeight] = useState(null)

  const [box, setBox] = useState({
    x: 50,
    y: 50,
    width: DEFAULT_SIG_WIDTH,
    height: DEFAULT_SIG_WIDTH * 0.4
  })

  const dragState = useRef(null)
  const resizeState = useRef(null)

  const pageRef = useRef(null)
  const containerRef = useRef(null)

  const pdfUrl =
    `http://10.229.14.24:8080/api/documents/${documentId}`

  // Fit PDF to available width
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        const containerWidth = containerRef.current.offsetWidth
        setRenderWidth(Math.min(MAX_PAGE_WIDTH, containerWidth))
      }
    }

    updateWidth()

    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  // When a new signature is set, size the box to match its natural aspect ratio
  useEffect(() => {
    if (!signature) {
      return
    }

    const img = new Image()

    img.onload = () => {
      const aspect = img.naturalHeight / img.naturalWidth
      setBox((prev) => ({
        ...prev,
        width: DEFAULT_SIG_WIDTH,
        height: Math.round(DEFAULT_SIG_WIDTH * aspect)
      }))
    }

    img.src = signature
  }, [signature])

  const onDocumentLoadSuccess = ({ numPages }) => {
    setNumPages(numPages)
  }

  const onPageLoadSuccess = useCallback((page) => {
    setPageOriginalWidth(page.originalWidth)
    setPageOriginalHeight(page.originalHeight)
  }, [])

  const reportPosition = useCallback((finalBox) => {
    if (!pageRef.current || !pageOriginalWidth || !pageOriginalHeight) {
      return
    }

    const pageRect = pageRef.current.getBoundingClientRect()
    const scale = pageOriginalWidth / pageRect.width

    const pdfX = finalBox.x * scale
    const pdfWidth = finalBox.width * scale
    const pdfHeight = finalBox.height * scale
    const pdfY = pageOriginalHeight - (finalBox.y * scale) - pdfHeight

    onPositionChange({
      page: 1,
      x: pdfX,
      y: pdfY,
      width: pdfWidth,
      height: pdfHeight
    })
  }, [pageOriginalWidth, pageOriginalHeight, onPositionChange])

  // ===== Drag to move =====

  const handleMoveStart = (event) => {
    event.preventDefault()
    const point = event.touches ? event.touches[0] : event

    dragState.current = {
      startX: point.clientX,
      startY: point.clientY,
      originX: box.x,
      originY: box.y
    }

    window.addEventListener('mousemove', handleMoveDrag)
    window.addEventListener('mouseup', handleMoveEnd)
    window.addEventListener('touchmove', handleMoveDrag, { passive: false })
    window.addEventListener('touchend', handleMoveEnd)
  }

  const handleMoveDrag = (event) => {
    if (!dragState.current || !pageRef.current) {
      return
    }
    event.preventDefault()

    const point = event.touches ? event.touches[0] : event
    const pageRect = pageRef.current.getBoundingClientRect()

    const deltaX = point.clientX - dragState.current.startX
    const deltaY = point.clientY - dragState.current.startY

    let newX = dragState.current.originX + deltaX
    let newY = dragState.current.originY + deltaY

    newX = Math.max(0, Math.min(newX, pageRect.width - box.width))
    newY = Math.max(0, Math.min(newY, pageRect.height - box.height))

    setBox((prev) => ({ ...prev, x: newX, y: newY }))
  }

  const handleMoveEnd = () => {
    window.removeEventListener('mousemove', handleMoveDrag)
    window.removeEventListener('mouseup', handleMoveEnd)
    window.removeEventListener('touchmove', handleMoveDrag)
    window.removeEventListener('touchend', handleMoveEnd)

    dragState.current = null

    setBox((current) => {
      reportPosition(current)
      return current
    })
  }

  // ===== Drag corner handle to resize =====

  const handleResizeStart = (event) => {
    event.preventDefault()
    event.stopPropagation()
    const point = event.touches ? event.touches[0] : event

    resizeState.current = {
      startX: point.clientX,
      startY: point.clientY,
      originWidth: box.width,
      originHeight: box.height
    }

    window.addEventListener('mousemove', handleResizeDrag)
    window.addEventListener('mouseup', handleResizeEnd)
    window.addEventListener('touchmove', handleResizeDrag, { passive: false })
    window.addEventListener('touchend', handleResizeEnd)
  }

  const handleResizeDrag = (event) => {
    if (!resizeState.current || !pageRef.current) {
      return
    }
    event.preventDefault()

    const point = event.touches ? event.touches[0] : event
    const pageRect = pageRef.current.getBoundingClientRect()

    const deltaX = point.clientX - resizeState.current.startX
    const deltaY = point.clientY - resizeState.current.startY

    let newWidth = resizeState.current.originWidth + deltaX
    let newHeight = resizeState.current.originHeight + deltaY

    newWidth = Math.max(MIN_SIG_SIZE, newWidth)
    newHeight = Math.max(MIN_SIG_SIZE, newHeight)

    setBox((prev) => {
      newWidth = Math.min(newWidth, pageRect.width - prev.x)
      newHeight = Math.min(newHeight, pageRect.height - prev.y)
      return { ...prev, width: newWidth, height: newHeight }
    })
  }

  const handleResizeEnd = () => {
    window.removeEventListener('mousemove', handleResizeDrag)
    window.removeEventListener('mouseup', handleResizeEnd)
    window.removeEventListener('touchmove', handleResizeDrag)
    window.removeEventListener('touchend', handleResizeEnd)

    resizeState.current = null

    setBox((current) => {
      reportPosition(current)
      return current
    })
  }

  return (
    <div className="pdf-viewer" ref={containerRef}>

      <h2>PDF Preview</h2>

      <Document
        file={pdfUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        onLoadError={(error) => {
          console.error('PDF loading error:', error)
        }}
      >

        {Array.from(
          new Array(numPages),
          (_, index) => (

            <div
              key={`page_${index + 1}`}
              ref={index === 0 ? pageRef : null}
              style={{
                position: 'relative',
                width: `${renderWidth}px`,
                marginBottom: '20px'
              }}
            >

              <Page
                pageNumber={index + 1}
                width={renderWidth}
                onLoadSuccess={index === 0 ? onPageLoadSuccess : undefined}
              />

              {signature && index === 0 && (

                <div
                  className="signature-box-draggable"
                  onMouseDown={handleMoveStart}
                  onTouchStart={handleMoveStart}
                  style={{
                    position: 'absolute',
                    left: `${box.x}px`,
                    top: `${box.y}px`,
                    width: `${box.width}px`,
                    height: `${box.height}px`,
                    border: '2px dashed blue',
                    cursor: 'move',
                    background: 'white',
                    zIndex: 10
                  }}
                >
                  <img
                    src={signature}
                    alt="Signature"
                    draggable={false}
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      pointerEvents: 'none'
                    }}
                  />

                  <div
                    className="resize-handle"
                    onMouseDown={handleResizeStart}
                    onTouchStart={handleResizeStart}
                  />
                </div>

              )}

            </div>

          )
        )}

      </Document>

    </div>
  )
}

export default PdfViewer