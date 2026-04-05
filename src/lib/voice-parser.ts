/**
 * Parse Vietnamese voice input into transaction data.
 * Examples:
 *   "ăn phở 50 nghìn" → { type: EXPENSE, amount: 50000, description: "ăn phở", categoryHint: "Ăn uống" }
 *   "lương tháng này được 33 triệu" → { type: INCOME, amount: 33000000, description: "lương tháng này", categoryHint: "Lương" }
 *   "đổ xăng 200k" → { type: EXPENSE, amount: 200000, description: "đổ xăng", categoryHint: "Di chuyển" }
 */

interface ParsedVoice {
  type: "INCOME" | "EXPENSE";
  amount: number | null;
  description: string;
  categoryHint: string | null;
}

const INCOME_KEYWORDS = ["lương", "thu nhập", "nhận tiền", "người ta trả", "được trả", "thưởng", "tiền thưởng", "tiền lương"];

// Noise words to remove from description
const NOISE_WORDS = [
  "được", "khoảng", "tầm", "là", "hết", "mất", "tốn", "chi", "tiêu",
  "trả", "cho", "với", "và", "rồi", "nha", "nhé", "nè", "á", "ạ",
  "vào", "ra", "lên", "xuống", "đi", "về", "thì", "bị", "phải",
  "cũng", "còn", "đã", "sẽ", "đang", "vừa", "mới",
];

const CATEGORY_MAP: Record<string, { keywords: string[]; altNames: string[] }> = {
  "Ăn uống": {
    keywords: ["ăn", "uống", "phở", "cơm", "bún", "cafe", "cà phê", "trà", "bia", "nhậu", "đồ ăn", "ăn sáng", "ăn trưa", "ăn tối", "ăn vặt", "trà sữa", "bánh", "chè", "lẩu", "nướng", "gà", "pizza", "mì"],
    altNames: ["an uong", "ăn uống"],
  },
  "Di chuyển": {
    keywords: ["xăng", "đổ xăng", "grab", "taxi", "xe", "gửi xe", "đi lại", "vé xe", "xăng xe", "uber", "gojek", "xe ôm"],
    altNames: ["di chuyen", "di chuyển"],
  },
  "Mua sắm": {
    keywords: ["mua", "shopping", "quần áo", "giày", "đồ dùng", "siêu thị", "shopee", "lazada", "tiki", "đặt hàng"],
    altNames: ["mua sam", "mua sắm"],
  },
  "Hóa đơn": {
    keywords: ["điện", "nước", "mạng", "wifi", "internet", "tiền nhà", "thuê nhà", "hóa đơn", "phí"],
    altNames: ["hoa don", "hóa đơn"],
  },
  "Giải trí": {
    keywords: ["phim", "game", "karaoke", "du lịch", "chơi", "giải trí", "netflix", "spotify", "youtube"],
    altNames: ["giai tri", "giải trí"],
  },
  "Sức khỏe": {
    keywords: ["thuốc", "bệnh viện", "khám", "bác sĩ", "y tế", "gym", "tập", "khám bệnh", "nha khoa"],
    altNames: ["suc khoe", "sức khỏe"],
  },
  "Lương": {
    keywords: ["lương", "salary", "tiền lương"],
    altNames: ["luong", "lương"],
  },
  "Thu nhập khác": {
    keywords: ["thu nhập", "thưởng", "freelance", "bonus", "tiền thưởng"],
    altNames: ["thu nhap khac", "thu nhập khác"],
  },
  "Tiền nhà": {
    keywords: ["tiền nhà", "cho thuê", "thuê nhà", "tiền trọ"],
    altNames: ["tien nha", "tiền nhà"],
  },
  "Khác": {
    keywords: [],
    altNames: ["khac", "khác"],
  },
};

function parseAmount(text: string): { amount: number | null; remaining: string } {
  let remaining = text;
  let amount: number | null = null;

  const patterns: [RegExp, (n: number) => number][] = [
    [/(\d+[.,]\d+)\s*triệu/i, (n) => n * 1000000],
    [/(\d+)\s*triệu/i, (n) => n * 1000000],
    [/(\d+[.,]\d+)\s*(nghìn|ngàn|nghin)/i, (n) => n * 1000],
    [/(\d+)\s*(nghìn|ngàn|nghin)/i, (n) => n * 1000],
    [/(\d+)\s*k\b/i, (n) => n * 1000],
    [/\b(\d{4,})\b/, (n) => n],
    [/\b(\d{1,3})\s*$/, (n) => n * 1000],
  ];

  for (const [pattern, transform] of patterns) {
    const match = remaining.match(pattern);
    if (match) {
      const numStr = match[1].replace(",", ".");
      amount = transform(parseFloat(numStr));
      remaining = remaining.replace(match[0], "").trim();
      break;
    }
  }

  return { amount, remaining };
}

function detectCategory(text: string): string | null {
  const lower = text.toLowerCase();

  // Check multi-word keywords first (longer = more specific)
  const entries = Object.entries(CATEGORY_MAP).sort(
    (a, b) => Math.max(...b[1].keywords.map((k) => k.length)) - Math.max(...a[1].keywords.map((k) => k.length))
  );

  for (const [category, { keywords }] of entries) {
    for (const kw of keywords.sort((a, b) => b.length - a.length)) {
      if (lower.includes(kw)) return category;
    }
  }
  return null;
}

function detectType(text: string): "INCOME" | "EXPENSE" {
  const lower = text.toLowerCase();
  for (const kw of INCOME_KEYWORDS) {
    if (lower.includes(kw)) return "INCOME";
  }
  return "EXPENSE";
}

function cleanDescription(text: string): string {
  let desc = text
    .replace(/\s+/g, " ")
    .trim();

  // Remove noise words at start and end
  const noisePattern = new RegExp(
    `^(${NOISE_WORDS.join("|")})\\s+|\\s+(${NOISE_WORDS.join("|")})$`,
    "gi"
  );

  // Apply multiple times to clean chained noise words
  for (let i = 0; i < 3; i++) {
    desc = desc.replace(noisePattern, "").trim();
  }

  // Remove standalone noise words that are the entire string
  if (NOISE_WORDS.includes(desc.toLowerCase())) {
    return "";
  }

  return desc;
}

export function parseVoiceInput(text: string): ParsedVoice {
  const type = detectType(text);
  const categoryHint = detectCategory(text); // detect from FULL text before cleaning
  const { amount, remaining } = parseAmount(text);
  const description = cleanDescription(remaining);

  return {
    type,
    amount,
    description: description || categoryHint || "",
    categoryHint,
  };
}

/**
 * Match categoryHint to actual category in user's list.
 * Handles both with-diacritics and without-diacritics names.
 */
export function matchCategory(
  hint: string,
  categories: { id: string; name: string; type: string }[],
  type: "INCOME" | "EXPENSE"
): string | null {
  const lowerHint = hint.toLowerCase();
  const filtered = categories.filter((c) => c.type === type);

  // Exact match
  const exact = filtered.find((c) => c.name.toLowerCase() === lowerHint);
  if (exact) return exact.id;

  // Match by altNames (handles no-diacritics DB entries)
  const catConfig = CATEGORY_MAP[hint];
  if (catConfig) {
    for (const alt of catConfig.altNames) {
      const match = filtered.find((c) => c.name.toLowerCase() === alt.toLowerCase());
      if (match) return match.id;
    }
  }

  // Partial match
  const partial = filtered.find((c) =>
    c.name.toLowerCase().includes(lowerHint) || lowerHint.includes(c.name.toLowerCase())
  );
  if (partial) return partial.id;

  return null;
}
