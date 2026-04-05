export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n);
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(date));
}

export function formatMonthYear(month: number, year: number): string {
  return `Tháng ${month.toString().padStart(2, "0")}/${year}`;
}

export const CALC_MODE_LABELS: Record<string, string> = {
  PER_UNIT: "Theo số lượng",
  PER_PERSON: "Theo người",
  FIXED: "Cố định",
};

export const CALC_MODE_TOOLTIPS: Record<string, string> = {
  PER_UNIT: "Nhập số lượng sử dụng, hệ thống tự nhân với đơn giá",
  PER_PERSON: "Tự động tính theo số người ở trong phòng",
  FIXED: "Phí cố định, tính theo phòng",
};
