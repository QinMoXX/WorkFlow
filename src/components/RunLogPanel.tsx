type RunLogPanelProps = {
  logs: string[];
  isOpen: boolean;
  onToggle: () => void;
};

export function RunLogPanel({ logs, isOpen, onToggle }: RunLogPanelProps) {
  return (
    <section className={`log-panel ${isOpen ? "is-open" : ""}`}>
      <button type="button" onClick={onToggle}>
        运行日志
      </button>
      {isOpen && (
        <div className="log-list">
          {logs.map((log, index) => (
            <p key={`${log}-${index}`}>{log}</p>
          ))}
        </div>
      )}
    </section>
  );
}
