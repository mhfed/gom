(() => {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const icon = (name, cls = "") =>
    `<svg class="icon ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
  const escape = (value) =>
    String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const normalize = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .toLowerCase();
  const platforms = {
    zalo: { name: "Zalo", logo: "assets/zalo.png" },
    messenger: { name: "Messenger", logo: "assets/messenger.svg" },
    telegram: { name: "Telegram", logo: "assets/telegram.svg" },
  };
  let accounts = [
    {
      id: "zalo-personal",
      provider: "zalo",
      name: "Cá nhân",
      detail: "Hiếu · Tài khoản cá nhân",
      avatar: "H",
      unread: 2,
      pinned: true,
      notify: true,
    },
    {
      id: "zalo-work",
      provider: "zalo",
      name: "Công việc",
      detail: "Studio Mộc · Liên hệ khách hàng",
      avatar: "M",
      unread: 0,
      pinned: false,
      notify: true,
    },
    {
      id: "messenger-personal",
      provider: "messenger",
      name: "Bạn bè",
      detail: "Hiếu · Bạn bè & gia đình",
      avatar: "H",
      unread: 1,
      pinned: false,
      notify: true,
    },
    {
      id: "messenger-work",
      provider: "messenger",
      name: "Studio Mộc",
      detail: "Mộc · Cộng đồng sáng tạo",
      avatar: "M",
      unread: 0,
      pinned: false,
      notify: false,
    },
    {
      id: "telegram-work",
      provider: "telegram",
      name: "Công việc",
      detail: "Hiếu · Nhóm thiết kế",
      avatar: "H",
      unread: 4,
      pinned: true,
      notify: true,
    },
    {
      id: "telegram-personal",
      provider: "telegram",
      name: "Cá nhân",
      detail: "Hiếu · Kết nối riêng",
      avatar: "H",
      unread: 0,
      pinned: false,
      notify: true,
    },
  ];
  const chats = [
    {
      id: "moc",
      name: "Studio Mộc",
      initial: "M",
      color: "forest",
      text: "An: Mình chốt hướng này nhé 🌿",
      time: "10:42",
      unread: 2,
      subtitle: "3 thành viên · Không gian sáng tạo",
    },
    {
      id: "an",
      name: "An Nguyễn",
      initial: "A",
      color: "sand",
      text: "Chiều mình gặp lúc 3 giờ nha.",
      time: "10:28",
      unread: 1,
      subtitle: "Đang hoạt động",
    },
    {
      id: "design",
      name: "Design café",
      initial: "D",
      color: "clay",
      text: "Linh: Một chút cảm hứng hôm nay",
      time: "09:56",
      unread: 0,
      subtitle: "8 thành viên · Cùng làm điều đẹp",
    },
    {
      id: "minh",
      name: "Minh Anh",
      initial: "MA",
      color: "slate",
      text: "Bạn: Cảm ơn nhé, để mình xem.",
      time: "09:14",
      unread: 0,
      subtitle: "Hoạt động gần đây",
    },
    {
      id: "weekend",
      name: "Cuối tuần đi đâu?",
      initial: "W",
      color: "lavender",
      text: "Nam vừa gửi một địa điểm.",
      time: "Hôm qua",
      unread: 1,
      subtitle: "5 thành viên · Chuyện cuối tuần",
    },
    {
      id: "linh",
      name: "Linh Trần",
      initial: "L",
      color: "rose",
      text: "Hẹn gặp cả nhóm sáng mai!",
      time: "Hôm qua",
      unread: 0,
      subtitle: "Hoạt động gần đây",
    },
  ];
  const state = {
    theme: "light",
    collapsed: false,
    sidebarWidth: 224,
    scene: "chat",
    active: "telegram-work",
    conversation: "moc",
    filter: "all",
    chatFilter: "all",
    settings: "accounts",
    commandIndex: 0,
    editor: null,
  };
  const drafts = new Map(),
    sent = new Map();
  let commandItems = [],
    toastTimer;
  const activeAccount = () => accounts.find((a) => a.id === state.active);
  const draftKey = () => state.active + ":" + state.conversation;
  function rememberFocus(...ids) {
    const active = document.activeElement;
    if (!active || !ids.some((id) => $(id).contains(active))) return () => {};
    const key = [...active.attributes].find((a) => a.name.startsWith("data-"));
    const selector = active.id
      ? "#" + CSS.escape(active.id)
      : key
        ? `[${key.name}="${CSS.escape(key.value)}"]`
        : null;
    return () => {
      if (selector)
        document.querySelector(selector)?.focus({ preventScroll: true });
    };
  }
  function toast(message) {
    $("toast").textContent = message;
    $("toast").hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => ($("toast").hidden = true), 3500);
  }
  function avatar(a) {
    return `<span class="account-avatar avatar-${a.provider}">${escape(a.avatar)}<img class="avatar-provider" src="${platforms[a.provider].logo}" alt=""></span>`;
  }
  function accountButton(a) {
    const p = platforms[a.provider];
    return `<button class="account-item ${state.active === a.id ? "active" : ""}" data-account="${a.id}" aria-label="${escape(p.name + " · " + a.name + (a.unread ? " · " + a.unread + " chưa đọc" : ""))}" aria-current="${state.active === a.id ? "true" : "false"}" title="${escape(p.name + " · " + a.name)}">${avatar(a)}<span class="account-text"><strong>${escape(a.name)}</strong><small>${p.name}</small></span>${a.unread ? `<span class="unread">${a.unread}</span>` : a.pinned ? icon("pin", "pin-mini") : ""}</button>`;
  }
  function renderNav() {
    const restoreFocus = rememberFocus("account-nav");
    const groups = [];
    const pinned = accounts.filter((a) => a.pinned);
    if (pinned.length)
      groups.push(
        `<div class="account-group"><div class="group-title">${icon("pin")}<span>Đã ghim</span></div>${pinned.map(accountButton).join("")}</div>`,
      );
    for (const [provider, p] of Object.entries(platforms)) {
      const list = accounts.filter((a) => a.provider === provider && !a.pinned);
      if (list.length)
        groups.push(
          `<div class="account-group"><div class="group-title"><img src="${p.logo}" alt="${p.name}"><span>${p.name}</span></div>${list.map(accountButton).join("")}</div>`,
        );
    }
    $("account-nav").innerHTML = groups.join("");
    $("settings-nav").classList.toggle("active", state.scene === "accounts");
    $("account-nav")
      .querySelectorAll("[data-account]")
      .forEach((b) => (b.onclick = () => selectAccount(b.dataset.account)));
    restoreFocus();
  }
  function renderToolbar() {
    const a = activeAccount(),
      p = platforms[a.provider];
    $("breadcrumb").innerHTML =
      state.scene === "accounts"
        ? `${icon("settings")}<strong>Tài khoản & cài đặt</strong>`
        : `<img src="${p.logo}" alt=""><span class="provider-name">${p.name}</span><span class="slash">/</span><strong>${escape(a.name)}</strong>`;
    $("provider-caption-name").textContent = p.name + " Web";
  }
  function setScene(scene) {
    state.scene = scene;
    $("chat-view").hidden = scene !== "chat";
    $("accounts-view").hidden = scene !== "accounts";
    renderNav();
    renderToolbar();
    document
      .querySelectorAll("[data-scene]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.scene === scene)),
      );
    if (scene === "accounts") renderSettings();
  }
  function selectAccount(id) {
    state.active = id;
    setScene("chat");
    renderConversation();
  }
  function setTheme(theme) {
    state.theme = theme;
    document.documentElement.dataset.theme = theme;
    $("theme-toggle").innerHTML =
      icon(theme === "light" ? "moon" : "sun") +
      `<span>${theme === "light" ? "Tối" : "Sáng"}</span>`;
    $("theme-toggle").setAttribute(
      "aria-label",
      theme === "light"
        ? "Chuyển sang giao diện tối"
        : "Chuyển sang giao diện sáng",
    );
    document
      .querySelectorAll("[data-theme-choice]")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.themeChoice === theme),
      );
  }
  function setCollapsed(collapsed) {
    state.collapsed = collapsed;
    $("app-window").classList.toggle("collapsed", collapsed);
    $("collapse-toggle").setAttribute("aria-expanded", String(!collapsed));
    $("collapse-toggle").setAttribute(
      "aria-label",
      collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar",
    );
    $("compact-setting").setAttribute("aria-checked", String(collapsed));
  }
  function renderChats() {
    const restoreFocus = rememberFocus("conversations");
    const q = normalize($("chat-search").value);
    const results = chats.filter(
      (c) =>
        normalize(c.name).includes(q) &&
        (state.chatFilter === "all" || c.unread),
    );
    $("conversations").innerHTML = results.length
      ? results
          .map(
            (c) =>
              `<button class="conversation-item ${state.conversation === c.id ? "active" : ""}" data-conversation="${c.id}" aria-label="${escape(c.name)}"><span class="person-avatar ${c.color}">${c.initial}</span><div><div class="row"><strong>${escape(c.name)}</strong><time>${c.time}</time></div><div class="row"><p>${escape(c.text)}</p>${c.unread ? `<span class="small-unread">${c.unread}</span>` : ""}</div></div></button>`,
          )
          .join("")
      : '<p class="empty">Không có cuộc trò chuyện phù hợp.</p>';
    $("conversations")
      .querySelectorAll("[data-conversation]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            state.conversation = b.dataset.conversation;
            renderChats();
            renderConversation();
          }),
      );
    restoreFocus();
  }
  function renderConversation() {
    const c = chats.find((c) => c.id === state.conversation);
    $("conversation-title").textContent = c.name;
    $("conversation-subtitle").textContent = c.subtitle;
    $("conversation-avatar").className = "person-avatar " + c.color;
    $("conversation-avatar").textContent = c.initial;
    let markup = '<p class="day-label">Hôm nay, 24 tháng 10</p>';
    if (c.id === "moc")
      markup += `<div class="message"><span class="person-avatar sand">A</span><div class="message-content"><p class="message-sender">An Nguyễn</p><div class="bubble"><p>Mình gửi cả nhóm bản moodboard mới.<br>Nhẹ hơn một chút, gần gũi hơn một chút 🌿</p></div><div class="attachment"><div class="attachment-cover"><div class="cover-name">mộc.<small>A QUIETER KIND OF BEAUTIFUL</small></div></div><div class="file-meta"><span>${icon("file")}</span><div><strong>Moc — Direction 02.pdf</strong><small>4,2 MB · Tài liệu PDF</small></div></div></div><time>10:38</time></div></div><div class="message outgoing"><div class="message-content"><div class="bubble"><p>Thích hướng này. Màu xanh rất dịu,<br>phần chữ cũng thoáng hơn hẳn.</p></div><time>10:40 · Đã xem</time></div></div><div class="message"><span class="person-avatar sand">A</span><div class="message-content"><div class="bubble"><p>Vậy mình chốt hướng này nhé.<br>Chiều cùng xem tiếp phần ứng dụng.</p></div><span class="reaction">🌿 2</span><time>10:42</time></div></div>`;
    else
      markup += `<div class="message"><span class="person-avatar ${c.color}">${c.initial}</span><div class="message-content"><p class="message-sender">${escape(c.name)}</p><div class="bubble"><p>${escape(c.text.replace(/^.*?: /, ""))}</p></div><time>${c.time}</time></div></div><div class="message outgoing"><div class="message-content"><div class="bubble"><p>Được nhé, mình cùng xem tiếp.</p></div><time>10:42 · Đã xem</time></div></div>`;
    const custom = sent.get(draftKey()) || [];
    markup += custom
      .map(
        (text) =>
          `<div class="message outgoing"><div class="message-content"><div class="bubble"><p>${escape(text)}</p></div><time>Vừa xong · Chỉ trong prototype</time></div></div>`,
      )
      .join("");
    $("messages").innerHTML = markup;
    $("message-input").value = drafts.get(draftKey()) || "";
    if (custom.length) $("messages").scrollTop = $("messages").scrollHeight;
    else $("messages").scrollTop = 0;
  }
  function renderSettings() {
    const restoreFocus = rememberFocus(
      "account-table",
      "notification-settings",
    );
    $("account-count").textContent = accounts.length;
    $("connected-count").textContent = accounts.length + " tài khoản minh họa";
    const list = accounts.filter(
      (a) => state.filter === "all" || a.provider === state.filter,
    );
    $("account-table").innerHTML = list
      .map(
        (a) =>
          `<div class="account-row"><img class="platform-logo" src="${platforms[a.provider].logo}" alt="${platforms[a.provider].name}"><div class="identity"><strong>${escape(a.name)}</strong><small>${escape(a.detail)}</small></div><span class="status-pill"><i></i>Đã kết nối</span><div class="row-actions"><button class="icon-button ${a.pinned ? "pinned" : ""}" data-pin="${a.id}" aria-pressed="${a.pinned}" aria-label="${a.pinned ? "Bỏ ghim" : "Ghim"} ${escape(platforms[a.provider].name + " " + a.name)}" title="${a.pinned ? "Bỏ ghim" : "Ghim"}">${icon("pin")}</button><button class="icon-button" data-notify="${a.id}" aria-pressed="${a.notify}" aria-label="${a.notify ? "Tắt" : "Bật"} thông báo ${escape(platforms[a.provider].name + " " + a.name)}" title="${a.notify ? "Tắt" : "Bật"} thông báo">${icon(a.notify ? "bell" : "bell-off")}</button><button class="icon-button" data-edit="${a.id}" aria-label="Đổi tên ${escape(platforms[a.provider].name + " " + a.name)}" title="Đổi tên">${icon("more")}</button><button class="icon-button" data-open="${a.id}" aria-label="Mở ${escape(platforms[a.provider].name + " " + a.name)}" title="Mở">${icon("arrow")}</button></div></div>`,
      )
      .join("");
    $("account-table")
      .querySelectorAll("[data-pin]")
      .forEach(
        (b) =>
          (b.onclick = () => {
            const a = accounts.find((a) => a.id === b.dataset.pin);
            a.pinned = !a.pinned;
            renderNav();
            renderSettings();
            toast(
              (a.pinned ? "Đã ghim " : "Đã bỏ ghim ") +
                platforms[a.provider].name +
                " · " +
                a.name,
            );
          }),
      );
    $("account-table")
      .querySelectorAll("[data-notify]")
      .forEach((b) => (b.onclick = () => toggleNotify(b.dataset.notify)));
    $("account-table")
      .querySelectorAll("[data-edit]")
      .forEach((b) => (b.onclick = () => openEditor(b.dataset.edit)));
    $("account-table")
      .querySelectorAll("[data-open]")
      .forEach((b) => (b.onclick = () => selectAccount(b.dataset.open)));
    $("notification-settings").innerHTML = accounts
      .map(
        (a) =>
          `<div class="preference-row"><img src="${platforms[a.provider].logo}" alt=""><div><strong>${escape(a.name)}</strong><small>${platforms[a.provider].name}</small></div><button class="switch" role="switch" aria-checked="${a.notify}" data-notification="${a.id}" aria-label="Thông báo ${escape(platforms[a.provider].name + " " + a.name)}"><i></i></button></div>`,
      )
      .join("");
    $("notification-settings")
      .querySelectorAll("[data-notification]")
      .forEach((b) => (b.onclick = () => toggleNotify(b.dataset.notification)));
    restoreFocus();
  }
  function toggleNotify(id) {
    const a = accounts.find((a) => a.id === id);
    a.notify = !a.notify;
    renderSettings();
    toast(
      (a.notify ? "Bật" : "Tắt") +
        " thông báo " +
        a.name +
        " trong bản xem thử.",
    );
  }
  function settingsTab(tab) {
    state.settings = tab;
    document
      .querySelectorAll("[data-settings]")
      .forEach((b) => b.classList.toggle("active", b.dataset.settings === tab));
    for (const id of ["accounts", "appearance", "notifications"])
      $("settings-" + id).hidden = id !== tab;
  }
  function openEditor(id = null) {
    state.editor = id;
    const a = id ? accounts.find((a) => a.id === id) : null;
    $("editor-title").textContent = a
      ? "Một tên dễ nhớ hơn."
      : "Thêm một kết nối.";
    $("editor-provider").value = a?.provider || "zalo";
    $("editor-provider").disabled = !!a;
    $("editor-name").value = a?.name || "";
    $("save-account").textContent = a ? "Lưu tên mới" : "Thêm tài khoản";
    $("account-editor").showModal();
    setTimeout(() => $("editor-name").focus(), 0);
  }
  function closeCommand() {
    $("command-search").setAttribute("aria-expanded", "false");
    if ($("command-dialog").open) $("command-dialog").close();
    document
      .querySelectorAll("[data-scene]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.scene === state.scene)),
      );
  }
  function openCommand() {
    if ($("account-editor").open) return;
    $("command-search").value = "";
    state.commandIndex = 0;
    renderCommands();
    if (!$("command-dialog").open) $("command-dialog").showModal();
    document
      .querySelectorAll("[data-scene]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.scene === "command")),
      );
    $("command-search").setAttribute("aria-expanded", "true");
    $("command-search").focus();
  }
  function renderCommands() {
    const q = normalize($("command-search").value);
    const matches = accounts.filter((a) =>
      normalize(
        platforms[a.provider].name + " " + a.name + " " + a.detail,
      ).includes(q),
    );
    const shown = q
      ? matches
      : accounts
          .filter((a) => a.pinned)
          .concat(accounts.filter((a) => a.id === state.active && !a.pinned))
          .slice(0, 3);
    const actions = [
      {
        id: "manage",
        label: "Quản lý tài khoản",
        hint: "Mọi kết nối trong một nơi",
        icon: "users",
        run: () => {
          setScene("accounts");
          settingsTab("accounts");
        },
      },
      {
        id: "add",
        label: "Thêm tài khoản",
        hint: "Tạo một tài khoản minh họa",
        icon: "plus",
        run: () => openEditor(),
      },
      {
        id: "theme",
        label:
          state.theme === "light"
            ? "Chuyển giao diện tối"
            : "Chuyển giao diện sáng",
        hint: "Đổi sắc độ của không gian",
        icon: state.theme === "light" ? "moon" : "sun",
        run: () => setTheme(state.theme === "light" ? "dark" : "light"),
      },
      {
        id: "sidebar",
        label: state.collapsed ? "Mở rộng sidebar" : "Thu gọn sidebar",
        hint: "Thêm không gian cho cuộc trò chuyện",
        icon: "sidebar",
        run: () => setCollapsed(!state.collapsed),
      },
    ].filter((a) => !q || normalize(a.label).includes(q));
    commandItems = [
      ...shown.map((a) => ({
        id: a.id,
        label: a.name,
        hint: platforms[a.provider].name + " · " + a.detail.split(" · ")[0],
        logo: platforms[a.provider].logo,
        meta: a.unread ? a.unread + " chưa đọc" : "",
        run: () => selectAccount(a.id),
        group: "account",
      })),
      ...actions,
    ];
    state.commandIndex = Math.min(
      state.commandIndex,
      Math.max(0, commandItems.length - 1),
    );
    let html = "",
      last = "";
    commandItems.forEach((item, i) => {
      const group = item.group === "account" ? "TÀI KHOẢN" : "THAO TÁC";
      if (group !== last) {
        html += `<div class="command-section">${!q && group === "TÀI KHOẢN" ? "ĐÃ GHIM & GẦN ĐÂY" : group}</div>`;
        last = group;
      }
      html += `<button class="command-result" id="command-result-${i}" role="option" tabindex="-1" aria-selected="${i === state.commandIndex}" data-result="${i}">${item.logo ? `<img src="${item.logo}" alt="">` : icon(item.icon)}<span><strong>${escape(item.label)}</strong><small>${escape(item.hint)}</small></span><span class="result-meta">${escape(item.meta || "")}<kbd>↵</kbd></span></button>`;
    });
    $("command-results").innerHTML =
      html ||
      '<p class="empty">Chưa tìm thấy tài khoản hoặc thao tác phù hợp.</p>';
    $("command-results")
      .querySelectorAll("[data-result]")
      .forEach((b) => {
        b.onclick = () => runCommand(Number(b.dataset.result));
        b.onmouseenter = () => highlightCommand(Number(b.dataset.result));
        b.onfocus = () => highlightCommand(Number(b.dataset.result));
      });
    highlightCommand(state.commandIndex);
  }
  function highlightCommand(index) {
    if (commandItems.length)
      $("command-search").setAttribute(
        "aria-activedescendant",
        "command-result-" + index,
      );
    else $("command-search").removeAttribute("aria-activedescendant");
    state.commandIndex = index;
    $("command-results")
      .querySelectorAll("[data-result]")
      .forEach((b, i) => b.setAttribute("aria-selected", String(i === index)));
  }
  function runCommand(index) {
    const item = commandItems[index];
    if (item) {
      closeCommand();
      item.run();
    }
  }
  document.querySelectorAll("[data-scene]").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.scene === "command") {
          setScene("chat");
          openCommand();
        } else {
          closeCommand();
          setScene(b.dataset.scene);
          if (b.dataset.scene === "accounts") settingsTab("accounts");
        }
      }),
  );
  document
    .querySelectorAll("[data-add]")
    .forEach((b) => (b.onclick = () => openEditor()));
  $("theme-toggle").onclick = () =>
    setTheme(state.theme === "light" ? "dark" : "light");
  $("collapse-toggle").onclick = () => setCollapsed(!state.collapsed);
  $("compact-setting").onclick = () => setCollapsed(!state.collapsed);
  $("quick-search").onclick = openCommand;
  $("settings-nav").onclick = () => {
    setScene("accounts");
    settingsTab("accounts");
  };
  $("profile-button").onclick = () => setScene("accounts");
  $("refresh").onclick = () =>
    toast("Khung chat đã làm mới trong bản xem thử.");
  $("external").onclick = () =>
    toast("Trong app thật, thao tác này mở nền tảng trong trình duyệt.");
  $("compose-button").onclick = () => $("chat-search").focus();
  $("conversation-info").onclick = () =>
    toast("Cuộc trò chuyện và tài liệu này đều là dữ liệu minh họa.");
  $("attach-button").onclick = () =>
    toast("Đính kèm sẽ dùng thao tác gốc của nền tảng trong app thật.");
  $("emoji-button").onclick = () => {
    $("message-input").value += " 🌿";
    drafts.set(draftKey(), $("message-input").value);
    $("message-input").focus();
  };
  $("chat-search").oninput = renderChats;
  document.querySelectorAll("[data-chat-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        state.chatFilter = b.dataset.chatFilter;
        document
          .querySelectorAll("[data-chat-filter]")
          .forEach((x) => x.classList.toggle("selected", x === b));
        renderChats();
      }),
  );
  $("message-input").oninput = () =>
    drafts.set(draftKey(), $("message-input").value);
  $("composer").onsubmit = (e) => {
    e.preventDefault();
    const text = $("message-input").value.trim();
    if (!text) return;
    const list = sent.get(draftKey()) || [];
    list.push(text);
    sent.set(draftKey(), list);
    drafts.delete(draftKey());
    renderConversation();
    $("message-input").focus();
  };
  document.querySelectorAll("[data-filter]").forEach(
    (b) =>
      (b.onclick = () => {
        state.filter = b.dataset.filter;
        document
          .querySelectorAll("[data-filter]")
          .forEach((x) => x.classList.toggle("selected", x === b));
        renderSettings();
      }),
  );
  document
    .querySelectorAll("[data-settings]")
    .forEach((b) => (b.onclick = () => settingsTab(b.dataset.settings)));
  document
    .querySelectorAll("[data-theme-choice]")
    .forEach((b) => (b.onclick = () => setTheme(b.dataset.themeChoice)));
  document
    .querySelectorAll("[data-close-command]")
    .forEach((b) => (b.onclick = closeCommand));
  $("command-search").oninput = () => {
    state.commandIndex = 0;
    renderCommands();
  };
  $("command-dialog").addEventListener("close", closeCommand);
  $("command-dialog").addEventListener("click", (e) => {
    if (e.target === $("command-dialog")) {
      const r = $("command-dialog").getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        closeCommand();
    }
  });
  $("command-dialog").addEventListener("keydown", (e) => {
    const result = e.target.closest(".command-result");
    if (e.target !== $("command-search") && !result) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!commandItems.length) return;
      const delta = e.key === "ArrowDown" ? 1 : -1;
      highlightCommand(
        (state.commandIndex + delta + commandItems.length) %
          commandItems.length,
      );
      if (result)
        $("command-result-" + state.commandIndex)?.focus({
          preventScroll: true,
        });
      $("command-result-" + state.commandIndex)?.scrollIntoView({
        block: "nearest",
      });
    } else if (e.key === "Enter") {
      e.preventDefault();
      runCommand(state.commandIndex);
    }
  });
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
      e.preventDefault();
      $("command-dialog").open ? closeCommand() : openCommand();
    }
  });
  const closeEditor = () => $("account-editor").close();
  $("close-editor").onclick = closeEditor;
  $("cancel-editor").onclick = closeEditor;
  $("account-form").onsubmit = (e) => {
    e.preventDefault();
    const name = $("editor-name").value.trim();
    if (!name) {
      $("editor-name").focus();
      return;
    }
    if (state.editor) {
      accounts.find((a) => a.id === state.editor).name = name;
    } else {
      const provider = $("editor-provider").value;
      accounts.push({
        id: "demo-" + Date.now(),
        provider,
        name,
        detail: "Tài khoản minh họa · Chưa kết nối dịch vụ",
        avatar: name.slice(0, 1).toUpperCase(),
        unread: 0,
        pinned: false,
        notify: true,
      });
    }
    closeEditor();
    renderNav();
    renderSettings();
    renderToolbar();
    toast(
      state.editor
        ? "Đã đổi tên trong prototype."
        : "Đã thêm tài khoản minh họa.",
    );
  };
  const resizer = $("sidebar-resizer");
  let dragStart = null;
  const width = (value) => {
    state.sidebarWidth = Math.max(200, Math.min(300, Math.round(value)));
    $("app-window").style.setProperty(
      "--sidebar-width",
      state.sidebarWidth + "px",
    );
    resizer.setAttribute("aria-valuenow", state.sidebarWidth);
  };
  resizer.onpointerdown = (e) => {
    dragStart = { x: e.clientX, width: state.sidebarWidth };
    resizer.setPointerCapture(e.pointerId);
    document.body.classList.add("dragging");
  };
  resizer.onpointermove = (e) => {
    if (dragStart) width(dragStart.width + e.clientX - dragStart.x);
  };
  const stopDrag = () => {
    dragStart = null;
    document.body.classList.remove("dragging");
  };
  resizer.onpointerup = stopDrag;
  resizer.onlostpointercapture = stopDrag;
  resizer.onpointercancel = stopDrag;
  resizer.ondblclick = () => width(224);
  resizer.onkeydown = (e) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      width(
        e.key === "Home"
          ? 200
          : e.key === "End"
            ? 300
            : state.sidebarWidth + (e.key === "ArrowRight" ? 8 : -8),
      );
    }
  };
  setTheme("light");
  setCollapsed(false);
  setScene("chat");
  renderChats();
  renderConversation();
  renderSettings();
  settingsTab("accounts");
})();
