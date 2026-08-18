const awbs: string[] = [""];
const cleanedAwbs = awbs.map(a => a.trim()).filter(a => a !== "");
const uniqueAwbs = Array.from(new Set(cleanedAwbs));
const existingAwbs = new Set<string>();
const newAwbsToSave = uniqueAwbs.filter(awb => !existingAwbs.has(awb));
