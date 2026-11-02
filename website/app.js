const menuButton = document.querySelector(".menu-toggle");
const menuLinks = document.querySelector(".nav-links");

function closeMenu() {
  menuButton.setAttribute("aria-expanded", "false");
  menuButton.setAttribute("aria-label", "Mở menu");
  menuLinks.classList.remove("is-open");
}

menuButton.addEventListener("click", () => {
  const open = menuButton.getAttribute("aria-expanded") !== "true";
  menuButton.setAttribute("aria-expanded", String(open));
  menuButton.setAttribute("aria-label", open ? "Đóng menu" : "Mở menu");
  menuLinks.classList.toggle("is-open", open);
});

menuLinks.addEventListener("click", (event) => {
  if (event.target.closest("a")) closeMenu();
});

const providers = {
  telegram: {
    name: "Telegram",
    icon: "telegram.svg",
    color: "#dceee2",
    title: "Minh Anh",
    subtitle: "Cuộc trò chuyện mẫu",
    messages: [
      "Chiều nay mình cà phê nhé? ☕",
      "Được chứ! Mình vừa xong việc rồi.",
      "Hẹn bạn ở quán quen nhé!",
    ],
    composer: "Viết tin nhắn…",
  },
  zalo: {
    name: "Zalo",
    icon: "zalo.png",
    color: "#ddebf9",
    title: "Minh Anh",
    subtitle: "Cuộc trò chuyện mẫu · Zalo",
    messages: [
      "Mình gửi bạn tài liệu buổi họp nha 📎",
      "Mình nhận được rồi. Cảm ơn bạn!",
      "Có gì mình trao đổi thêm nhé.",
    ],
    composer: "Nhập tin nhắn…",
  },
  messenger: {
    name: "Messenger",
    icon: "messenger.svg",
    color: "#e9e1f7",
    title: "Minh Anh",
    subtitle: "Cuộc trò chuyện mẫu · Messenger",
    messages: [
      "Cuối tuần đi dạo một chút không? 🌿",
      "Có chứ! Để mình rủ thêm Linh nữa.",
      "Tuyệt. Hẹn nhau chiều thứ Bảy nhé!",
    ],
    composer: "Aa…",
  },
  gmail: {
    name: "Gmail",
    icon: "gmail.svg",
    color: "#f3e6d9",
    title: "Lịch hẹn cuối tuần",
    subtitle: "Email mẫu · Minh Anh",
    messages: [
      "Chào bạn, mình gửi lịch hẹn cuối tuần này.",
      "Mình đã xem lịch. Hẹn bạn lúc 15:00 nhé!",
      "Cảm ơn bạn. Chúc bạn một ngày thật vui ☀️",
    ],
    composer: "Trả lời email…",
  },
};

const tabs = [...document.querySelectorAll("[data-provider]")];
const panel = document.querySelector("[data-provider-panel]");
const previewIcon = document.querySelector("[data-current-provider-icon]");

function selectProvider(tab) {
  const provider = providers[tab.dataset.provider];
  if (!provider) return;
  for (const item of tabs) {
    const selected = item === tab;
    item.setAttribute("aria-selected", String(selected));
    item.tabIndex = selected ? 0 : -1;
  }
  panel.setAttribute("aria-labelledby", tab.id);
  panel.style.setProperty("--chat-color", provider.color);
  document.querySelector("[data-current-provider]").textContent = provider.name;
  previewIcon.src = new URL(
    `./assets/providers/${provider.icon}`,
    document.baseURI,
  ).href;
  document.querySelector("[data-conversation-title]").textContent =
    provider.title;
  document.querySelector("[data-conversation-subtitle]").textContent =
    provider.subtitle;
  document.querySelector("[data-message-one]").textContent =
    provider.messages[0];
  document.querySelector("[data-message-two]").textContent =
    provider.messages[1];
  document.querySelector("[data-message-three]").textContent =
    provider.messages[2];
  document.querySelector("[data-chat-snippet]").textContent =
    provider.messages[2];
  document.querySelector("[data-composer]").textContent = provider.composer;
}

for (const tab of tabs) {
  tab.disabled = false;
  tab.setAttribute("aria-label", providers[tab.dataset.provider].name);
  tab.addEventListener("click", () => selectProvider(tab));
  tab.addEventListener("keydown", (event) => {
    const index = tabs.indexOf(tab);
    let next;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft")
      next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next === undefined) return;
    event.preventDefault();
    selectProvider(tabs[next]);
    tabs[next].focus();
  });
}

const floatOpen = document.querySelector("[data-float-open]");
const floatClose = document.querySelector("[data-float-close]");
const floatingDemo = document.querySelector("#floating-demo");

function closeFloat() {
  floatingDemo.hidden = true;
  floatOpen.setAttribute("aria-expanded", "false");
}

floatOpen.addEventListener("click", () => {
  if (!floatingDemo.hidden) {
    closeFloat();
    return;
  }
  const provider =
    providers[
      document.querySelector('[data-provider][aria-selected="true"]').dataset
        .provider
    ];
  floatingDemo.querySelector("img").src = new URL(
    `./assets/providers/${provider.icon}`,
    document.baseURI,
  ).href;
  floatingDemo.querySelector("strong").textContent = provider.title;
  floatingDemo.querySelector("p").textContent = provider.messages[2];
  floatingDemo.hidden = false;
  floatOpen.setAttribute("aria-expanded", "true");
  floatClose.focus({ preventScroll: true });
});

floatClose.addEventListener("click", () => {
  closeFloat();
  floatOpen.focus({ preventScroll: true });
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  if (!floatingDemo.hidden) {
    closeFloat();
    floatOpen.focus({ preventScroll: true });
  }
  if (menuButton.getAttribute("aria-expanded") === "true") {
    closeMenu();
    menuButton.focus({ preventScroll: true });
  }
});

// A deep link to installation/privacy should expose the answer immediately.
function revealLinkedAnswer() {
  const target = document.getElementById(location.hash.slice(1));
  if (target instanceof HTMLDetailsElement) target.open = true;
}

window.addEventListener("hashchange", revealLinkedAnswer);
for (const link of document.querySelectorAll('a[href^="#"]')) {
  link.addEventListener("click", () => {
    const target = document.getElementById(link.hash.slice(1));
    if (target instanceof HTMLDetailsElement) target.open = true;
  });
}
revealLinkedAnswer();
document.documentElement.classList.add("enhanced");
