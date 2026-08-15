const fs = require('fs');

let content = fs.readFileSync('src/lib/ocr.ts', 'utf8');

const newGroupWords = `const groupWordsIntoAwbs = (candidates: OcrWord[]): OcrWord[] => {
    // 1. Group words into text lines based on Y-overlap / proximity
    const lines: OcrWord[][] = [];
    const sortedWords = [...candidates].sort((a, b) => a.bbox.y0 - b.bbox.y0);
    
    for (const word of sortedWords) {
      const wordCenterY = (word.bbox.y0 + word.bbox.y1) / 2;
      let foundLine = false;
      for (const line of lines) {
        const lineCenterY = line.reduce((sum, w) => sum + (w.bbox.y0 + w.bbox.y1) / 2, 0) / line.length;
        if (Math.abs(wordCenterY - lineCenterY) < 20) { 
          line.push(word);
          foundLine = true;
          break;
        }
      }
      if (!foundLine) {
        lines.push([word]);
      }
    }

    // 2. For each line, sort words left-to-right, then merge adjacent words
    const candidateBlocks: OcrWord[] = [];
    
    for (const line of lines) {
      line.sort((a, b) => a.bbox.x0 - b.bbox.x0);
      let currentBlock: OcrWord | null = null;
      
      for (const word of line) {
        if (!currentBlock) {
          currentBlock = { ...word, bbox: { ...word.bbox } };
        } else {
          const textHeight = currentBlock.bbox.y1 - currentBlock.bbox.y0;
          const gap = word.bbox.x0 - currentBlock.bbox.x1;
          
          // Merge if gap is small (e.g. less than 2.5x the height of the text)
          if (gap < textHeight * 2.5) { 
            currentBlock.text += word.text; // preserve no space for format check
            currentBlock.bbox.x1 = Math.max(currentBlock.bbox.x1, word.bbox.x1);
            currentBlock.bbox.y0 = Math.min(currentBlock.bbox.y0, word.bbox.y0);
            currentBlock.bbox.y1 = Math.max(currentBlock.bbox.y1, word.bbox.y1);
            currentBlock.confidence = Math.min(currentBlock.confidence, word.confidence);
          } else {
            candidateBlocks.push(currentBlock);
            currentBlock = { ...word, bbox: { ...word.bbox } };
          }
        }
      }
      if (currentBlock) {
        candidateBlocks.push(currentBlock);
      }
    }

    // 3. Filter blocks by AWB format
    return candidateBlocks
      .map(block => ({
        ...block,
        text: block.text.replace(/[^A-Z0-9]/gi, "").toUpperCase()
      }))
      .filter(block => isAwbFormat(block.text));
  };`;

content = content.replace(
  /const groupWordsIntoAwbs = \(candidates: OcrWord\[\]\): OcrWord\[\] => \{[\s\S]*?\}\);\s*return Object\.values\(lines\)[\s\S]*?\.filter\(line => isAwbFormat\(line\.text\)\);\s*\};/,
  newGroupWords
);

fs.writeFileSync('src/lib/ocr.ts', content);
