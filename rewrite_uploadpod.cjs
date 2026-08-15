const fs = require('fs');

let content = fs.readFileSync('src/components/UploadPod.tsx', 'utf8');

// Replace the states block
content = content.replace(
  /const \[activeAwbIndex, setActiveAwbIndex\] = useState\(0\);\s*\/\/ OCR specific states[\s\S]*?const fileInputRef = useRef<HTMLInputElement>\(null\);/,
`const [activeAwbIndex, setActiveAwbIndex] = useState(0);

  // On-image OCR states
  const [isFindingAwbs, setIsFindingAwbs] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [imageWords, setImageWords] = useState<OcrWord[]>([]);
  const [copiedAwb, setCopiedAwb] = useState<string | null>(null);
  const [imgDims, setImgDims] = useState({ w: 0, h: 0, nw: 0, nh: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateDimensions = () => {
    if (imgRef.current && containerRef.current) {
      const { naturalWidth: nw, naturalHeight: nh } = imgRef.current;
      const { clientWidth: cw, clientHeight: ch } = containerRef.current;
      if (!nw || !nh || !cw || !ch) return;
      
      const containerRatio = cw / ch;
      const imgRatio = nw / nh;
      let w, h;
      if (imgRatio > containerRatio) {
        w = cw;
        h = cw / imgRatio;
      } else {
        h = ch;
        w = ch * imgRatio;
      }
      setImgDims({ w, h, nw, nh });
    }
  };

  React.useEffect(() => {
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  const handleCopyAwb = async (text: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = text;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        try {
          document.execCommand("copy");
        } catch (error) {
          console.error(error);
        } finally {
          textArea.remove();
        }
      }
      setCopiedAwb(text);
      setTimeout(() => setCopiedAwb(null), 2000);
      
      // Auto-add to empty field
      setAwbs(currentAwbs => {
        const newAwbs = [...currentAwbs];
        const currentCleaned = newAwbs.map(a => a.trim());
        if (currentCleaned.includes(text)) {
          return currentAwbs; // already exists
        }
        
        const emptyIndex = newAwbs.findIndex(a => a.trim() === "");
        if (emptyIndex !== -1) {
          newAwbs[emptyIndex] = text;
        } else if (newAwbs.length < 20) {
          newAwbs.push(text);
        } else {
          setErrorMessage("Maximum 20 AWB numbers allowed.");
        }
        return newAwbs;
      });
      
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);`
);

// Update file selection to run OCR automatically
content = content.replace(
  /setErrorMessage\(null\);\s*setActiveAwbIndex\(0\);\s*\/\/\s*Reset OCR state[\s\S]*?setIsFindingAwbs\(false\);\s*\}/,
  `setErrorMessage(null);
      setActiveAwbIndex(0);
      
      // Reset OCR state
      setImageWords([]);
      setIsFindingAwbs(true);
      setOcrProgress(0);

      detectAwbBoxesInImage(selectedFile, (p) => setOcrProgress(p))
        .then(words => {
          setImageWords(words);
        })
        .catch(err => {
          console.error("OCR detection failed:", err);
        })
        .finally(() => {
          setIsFindingAwbs(false);
        });
    }`
);

// Update clearSelection
content = content.replace(
  /\/\/\s*Reset OCR state\s*setDetectedAwbs\(\[\]\);\s*setHasSearchedAwbs\(false\);\s*setIsFindingAwbs\(false\);/,
  `// Reset OCR state
    setImageWords([]);
    setIsFindingAwbs(false);`
);

// Remove findAwbs and handleAddDetectedAwb
content = content.replace(
  /const findAwbs = async \(\) => {[\s\S]*?const handleAddDetectedAwb = \(awb: string\) => {[\s\S]*?setDetectedAwbs\(prev => prev.filter\(a => a !== awb\)\);\s*};/,
  ``
);

// Replace the UI for the image and OCR Helper section
content = content.replace(
  /<div className="relative rounded-3xl overflow-hidden bg-black border border-white\/10 shadow-2xl aspect-\[3\/4\] sm:aspect-\[4\/3\] flex-shrink-0">[\s\S]*?Verify numbers before adding. OCR is an assistive helper only\.[\s\S]*?<\/div>\s*\)\s*:\s*hasSearchedAwbs[\s\S]*?<\/button>\s*\)\}\s*<\/div>\s*\)\}/,
  `<div 
            ref={containerRef}
            className="relative rounded-3xl overflow-hidden bg-black border border-white/10 shadow-2xl aspect-[3/4] sm:aspect-[4/3] flex-shrink-0 flex items-center justify-center"
          >
            {/* Inner wrapper perfectly sized to the image to map OCR absolute coordinates */}
            <div className="relative" style={{ width: imgDims.w || '100%', height: imgDims.h || '100%' }}>
              <img
                ref={imgRef}
                src={preview}
                alt="Preview"
                onLoad={updateDimensions}
                className="w-full h-full object-contain select-none pointer-events-none"
                style={{ WebkitTouchCallout: "none", WebkitUserSelect: "none" }}
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
              />
              
              {/* Tappable OCR Overlays */}
              {imgDims.w > 0 && imgDims.nw > 0 && imageWords.map((word, i) => {
                const scaleX = imgDims.w / imgDims.nw;
                const scaleY = imgDims.h / imgDims.nh;
                const left = word.bbox.x0 * scaleX;
                const top = word.bbox.y0 * scaleY;
                const width = (word.bbox.x1 - word.bbox.x0) * scaleX;
                const height = (word.bbox.y1 - word.bbox.y0) * scaleY;
                
                return (
                  <div
                    key={i}
                    onClick={(e) => { 
                      e.stopPropagation(); 
                      handleCopyAwb(word.text); 
                    }}
                    className="absolute cursor-pointer rounded border border-[#00FF66]/50 bg-[#00FF66]/10 hover:bg-[#00FF66]/30 hover:border-[#00FF66] transition-colors flex items-center justify-center group"
                    style={{ left, top, width, height }}
                  >
                    {copiedAwb === word.text && (
                      <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-50 bg-[#00FF66] text-black text-[10px] font-bold px-2 py-1 rounded shadow-lg whitespace-nowrap animate-in fade-in zoom-in slide-in-from-bottom-2 pointer-events-none">
                        AWB copied
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            
            {!loading && (
              <button
                onClick={(e) => { e.stopPropagation(); clearSelection(); }}
                className="absolute top-4 right-4 w-10 h-10 glass rounded-full flex items-center justify-center text-white hover:bg-red-500/80 transition-colors z-50"
              >
                <X className="w-5 h-5" />
              </button>
            )}

            {isFindingAwbs && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center px-4 py-2 gap-2 bg-black/80 backdrop-blur-md rounded-full border border-white/10 z-50 shadow-xl">
                <Loader2 className="w-4 h-4 animate-spin text-[#00FF66]" />
                <span className="text-xs font-medium text-[#00FF66]">Scanning AWBs... {Math.round(ocrProgress * 100)}%</span>
              </div>
            )}
          </div>
          
          <div className="flex flex-col gap-3">
            {/* The AWB lists and manual input remain untouched below */}`
);

fs.writeFileSync('src/components/UploadPod.tsx', content);
