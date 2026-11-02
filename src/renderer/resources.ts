import type { AppState, ProviderDefinition } from "../shared.ts";
const memory = (value: number | null | undefined) =>
  value == null
    ? "—"
    : (value >= 1024 ? value / 1024 : value).toLocaleString("vi-VN", {
        maximumFractionDigits: 1,
      }) + (value >= 1024 ? " GiB" : " MiB");
const cpu = (value: number | null | undefined) =>
  value == null
    ? "—"
    : value.toLocaleString("vi-VN", { maximumFractionDigits: 1 }) + "%";
function text(node: HTMLElement, value: string) {
  if (node.textContent !== value) node.textContent = value;
}
function attribute(node: Element, name: string, value: string) {
  if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}
function width(node: HTMLElement, value: number) {
  const size = value.toFixed(1) + "%";
  if (node.style.width !== size) node.style.width = size;
}
export function createResourcesUI(options: {
  getState(): AppState;
  activeTab(): string;
  logo?(provider: ProviderDefinition): HTMLElement;
  icon?(name: string): Element;
}) {
  const $ = <T extends HTMLElement>(id: string) =>
    document.getElementById(id) as T;
  const sort = $<HTMLSelectElement>("resource-sort"),
    list = $("resource-rows");
  let surface = "",
    rendered = "",
    generation = 0;
  const rows = new Map<
    string,
    {
      node: HTMLElement;
      title: HTMLElement;
      provider: HTMLElement;
      status: HTMLElement;
      detail: HTMLElement;
      memory: HTMLElement;
      cpu: HTMLElement;
      meter: HTMLElement;
      button: HTMLButtonElement;
      action: HTMLElement;
      actionIcon: HTMLElement;
      logo: HTMLElement;
      logoKey: string;
    }
  >();
  const visible = () => {
    const state = options.getState();
    return (
      !!state &&
      state.panel === "settings" &&
      options.activeTab() === "resources" &&
      !state.commandOpen &&
      document.visibilityState === "visible"
    );
  };
  function updateSurface() {
    const state = options.getState();
    if (!state?.privateSpace || typeof window.desktop.resources !== "function")
      return;
    const open = visible(),
      lockVersion = state.privateSpace.lockVersion!;
    const next = `${open}:${lockVersion}`;
    if (next === surface) return;
    surface = next;
    void window.desktop
      .resources("surface", { open, lockVersion })
      .catch(() => {});
  }
  function render(state: AppState) {
    const resources = state.resources;
    if (!resources || !visible()) return;
    const next = JSON.stringify([
      state.accounts,
      state.providers,
      state.statuses,
      resources,
      sort.value,
    ]);
    if (next === rendered) return;
    rendered = next;
    const snapshot = resources.snapshot,
      accounts = state.accounts.filter((a) => !a.archived);
    text($("resource-total"), memory(snapshot?.total.memoryMiB));
    text($("resource-total-cpu"), cpu(snapshot?.total.cpuPercent));
    text(
      $("resource-accounts-total"),
      memory(snapshot?.accountsTotal.memoryMiB),
    );
    text($("resource-other"), memory(snapshot?.other.memoryMiB));
    const running = accounts.filter(
      (a) =>
        !resources.sleeping.includes(a.id) && state.statuses[a.id] !== "idle",
    ).length;
    const asleepCount = accounts.filter((a) =>
      resources.sleeping.includes(a.id),
    ).length;
    text($("resource-running-count"), String(running));
    text($("resource-sleeping-count"), String(asleepCount));
    text(
      $("resource-idle-count"),
      String(accounts.length - running - asleepCount),
    );
    text($("resource-count"), String(accounts.length));
    const total = snapshot?.total.memoryMiB,
      accountMemory = snapshot?.accountsTotal.memoryMiB;
    const known = total != null && total > 0 && accountMemory != null;
    const portion = known
      ? Math.max(0, Math.min(100, (accountMemory / total) * 100))
      : 0;
    width($("resource-distribution-accounts"), portion);
    width($("resource-distribution-other"), known ? 100 - portion : 0);
    attribute($("resource-distribution"), "data-unknown", String(!known));
    attribute(
      $("resource-distribution"),
      "aria-label",
      "Tài khoản đang hiển thị " +
        memory(accountMemory) +
        "; phần còn lại " +
        memory(snapshot?.other.memoryMiB),
    );
    text(
      $("resource-sample-status"),
      resources.error ||
        (snapshot
          ? "Cập nhật " +
            new Date(snapshot.sampledAt).toLocaleTimeString("vi-VN")
          : "Đang lấy mẫu…"),
    );
    const label = (id: string) => {
      const account = accounts.find((a) => a.id === id)!;
      return (
        (state.providers.find((p) => p.id === account.provider)?.label ||
          "Website") +
        " · " +
        account.name
      );
    };
    accounts.sort((a, b) => {
      const key = sort.value === "cpu" ? "cpuPercent" : "memoryMiB";
      const x = snapshot?.accounts[a.id]?.[key],
        y = snapshot?.accounts[b.id]?.[key];
      if (sort.value !== "name" && x !== y) return (y ?? -1) - (x ?? -1);
      return label(a.id).localeCompare(label(b.id), "vi");
    });
    const maximum = Math.max(
      1,
      ...accounts.map((a) => snapshot?.accounts[a.id]?.memoryMiB ?? 0),
    );
    for (const [index, account] of accounts.entries()) {
      let row = rows.get(account.id);
      if (!row) {
        const node = document.createElement("div");
        node.className = "resource-row";
        node.dataset.account = account.id;
        node.setAttribute("role", "listitem");
        const identity = document.createElement("div"),
          logo = document.createElement("span"),
          names = document.createElement("div");
        identity.className = "resource-identity";
        logo.className = "resource-service-icon";
        names.className = "resource-account-names";
        const title = document.createElement("strong"),
          meta = document.createElement("div"),
          provider = document.createElement("span"),
          status = document.createElement("span"),
          detail = document.createElement("small");
        meta.className = "resource-account-meta";
        status.className = "resource-state";
        detail.className = "resource-detail";
        meta.append(provider, status);
        names.append(title, meta, detail);
        identity.append(logo, names);
        const ram = document.createElement("div"),
          mem = document.createElement("strong"),
          track = document.createElement("span"),
          meter = document.createElement("span");
        ram.className = "resource-ram";
        track.className = "resource-meter";
        meter.className = "resource-meter-fill";
        track.setAttribute("aria-hidden", "true");
        track.append(meter);
        ram.append(mem, track);
        const processor = document.createElement("strong");
        processor.className = "resource-cpu";
        const button = document.createElement("button"),
          actionIcon = document.createElement("span"),
          action = document.createElement("span");
        button.className = "secondary resource-action";
        button.type = "button";
        actionIcon.setAttribute("aria-hidden", "true");
        button.append(actionIcon, action);
        button.onclick = async () => {
          const current = options.getState(),
            version = generation;
          if (!current?.resources) return;
          const command = current.resources.sleeping.includes(account.id)
            ? "wake"
            : "sleep";
          button.disabled = true;
          text($("resource-feedback"), "");
          try {
            const result = await window.desktop.resources(command, {
              accountId: account.id,
              lockVersion: current.privateSpace!.lockVersion!,
            });
            if (version === generation && !result.ok)
              text(
                $("resource-feedback"),
                result.message || "Chưa đổi được trạng thái tài khoản.",
              );
          } catch {
            if (version === generation)
              text(
                $("resource-feedback"),
                "Chưa đổi được trạng thái tài khoản. Bạn thử lại nhé.",
              );
          } finally {
            if (version === generation) {
              rendered = "";
              render(options.getState());
            }
          }
        };
        node.append(identity, ram, processor, button);
        row = {
          node,
          title,
          provider,
          status,
          detail,
          memory: mem,
          cpu: processor,
          meter,
          button,
          action,
          actionIcon,
          logo,
          logoKey: "",
        };
        rows.set(account.id, row);
      }
      const asleep = resources.sleeping.includes(account.id),
        busy = resources.busy.includes(account.id),
        idle = state.statuses[account.id] === "idle" && !asleep;
      const measurement = snapshot?.accounts[account.id],
        definition = state.providers.find((p) => p.id === account.provider);
      const status = busy
        ? "busy"
        : asleep
          ? "sleeping"
          : idle
            ? "idle"
            : "running";
      const block = resources.blocked[account.id] || "";
      text(row.title, account.name);
      text(row.provider, definition?.label || "Website");
      const logoKey = JSON.stringify([account.provider, definition?.logo]);
      if (logoKey !== row.logoKey) {
        row.logoKey = logoKey;
        row.logo.replaceChildren(
          ...(definition && options.logo ? [options.logo(definition)] : []),
        );
      }
      text(
        row.status,
        busy
          ? "Đang xử lý"
          : asleep
            ? "Đang ngủ"
            : idle
              ? "Chưa mở"
              : "Đang chạy",
      );
      text(
        row.detail,
        block || (measurement?.shared ? "Chỉ đo được phần riêng" : ""),
      );
      text(row.memory, memory(measurement?.memoryMiB));
      text(row.cpu, cpu(measurement?.cpuPercent));
      width(
        row.meter,
        measurement?.memoryMiB == null
          ? 0
          : (measurement.memoryMiB / maximum) * 100,
      );
      attribute(
        row.meter.parentElement!,
        "data-unknown",
        String(measurement?.memoryMiB == null),
      );
      attribute(row.node, "data-state", status);
      text(row.action, asleep ? "Đánh thức" : "Tạm ngủ");
      const actionKey = asleep ? "wake" : "sleep";
      if (row.button.dataset.action !== actionKey) {
        row.button.dataset.action = actionKey;
        row.actionIcon.replaceChildren(
          ...(options.icon ? [options.icon(asleep ? "refresh" : "moon")] : []),
        );
      }
      attribute(
        row.button,
        "aria-label",
        (asleep ? "Đánh thức " : "Tạm ngủ ") + label(account.id),
      );
      const disabled =
        busy || resources.unavailable || idle || (!asleep && !!block);
      if (row.button.disabled !== disabled) row.button.disabled = disabled;
      const currentNode = list.children[index];
      if (currentNode !== row.node)
        list.insertBefore(row.node, currentNode || null);
    }
    text(
      $("resource-empty"),
      accounts.length ? "" : "Không có tài khoản trong không gian này.",
    );
  }
  sort.onchange = () => {
    rendered = "";
    if (options.getState()) render(options.getState());
  };
  document.addEventListener("visibilitychange", updateSurface);
  return {
    updateSurface,
    sync(state: AppState) {
      const allowed = new Set(
        state.accounts.filter((a) => !a.archived).map((a) => a.id),
      );
      for (const [id, row] of rows)
        if (!allowed.has(id)) {
          row.node.remove();
          rows.delete(id);
          rendered = "";
        }
      updateSurface();
      render(state);
    },
    reset() {
      generation++;
      surface = "";
      rendered = "";
      rows.clear();
      list.replaceChildren();
      text($("resource-feedback"), "");
      for (const id of [
        "resource-total",
        "resource-total-cpu",
        "resource-accounts-total",
        "resource-other",
        "resource-sample-status",
        "resource-running-count",
        "resource-sleeping-count",
        "resource-idle-count",
        "resource-count",
      ])
        text($(id), "—");
      width($("resource-distribution-accounts"), 0);
      width($("resource-distribution-other"), 0);
    },
  };
}
