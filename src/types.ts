export interface PodImage {
  id: string;
  user_id: string;
  image_url: string;
  ocr_text: string;
  tracking_numbers: string[];
  created_at: string;
}

export type FilterType = "today" | "yesterday" | "7days" | "30days" | "all";
