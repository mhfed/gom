interface BackgroundContents {
  isDestroyed(): boolean;
  getBackgroundThrottling(): boolean;
  setBackgroundThrottling(value: boolean): void;
  once(event: "destroyed", listener: () => void): unknown;
  removeListener(event: "destroyed", listener: () => void): unknown;
}

export function limitBackgroundWarmup(contents: BackgroundContents) {
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    contents.removeListener("destroyed", finish);
    if (!contents.isDestroyed() && !contents.getBackgroundThrottling())
      contents.setBackgroundThrottling(true);
  };
  // A login/QR page may never become authenticated. Do not exempt it forever.
  const timer = setTimeout(finish, 30_000);
  timer.unref();
  contents.once("destroyed", finish);
  return finish;
}
