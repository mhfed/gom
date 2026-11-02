import type { ProviderId } from "../shared.ts";

export function sessionImportState({
  target,
  hasProfiles,
  importing,
  accountBusy,
}: {
  target: { provider: ProviderId; label: string } | undefined;
  hasProfiles: boolean;
  importing: boolean;
  accountBusy: boolean;
}): { disabled: boolean; hint: string } {
  const disabled =
    importing ||
    accountBusy ||
    !target ||
    !hasProfiles ||
    target.provider === "whatsapp";
  const hint = importing
    ? "Đang kiểm tra phiên đã chọn. Bạn đợi một chút nhé."
    : accountBusy
      ? "Đợi thao tác tài khoản hoàn tất để dùng phiên Chrome."
      : !target
        ? "Thêm một tài khoản trước khi chọn phiên Chrome."
        : target.provider === "whatsapp"
          ? "Mở WhatsApp trong Gom và liên kết thiết bị trên điện thoại."
          : !hasProfiles
            ? "Chưa tìm thấy profile Chrome trên máy. Bạn có thể đăng nhập trực tiếp trong tài khoản đích."
            : `Chọn tài khoản ${target.label} và profile Chrome đã đăng nhập dịch vụ đó.`;
  return { disabled, hint };
}
