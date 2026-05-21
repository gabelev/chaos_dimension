import { useTheme } from '../themes';

export default function ModalShell({ title, children, width = 420, onClose, zIndex = 300 }) {
  const { theme } = useTheme();
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: theme.chrome,
          border: theme.windowBorder,
          width: `min(${width}px, calc(100vw - 16px))`,
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: theme.windowShadow || '4px 4px 0 rgba(0,0,0,0.3)',
          color: theme.text,
          fontFamily: theme.FONT,
          borderRadius: theme.window.borderRadius || 0,
          overflow: 'hidden',
        }}
      >
        <div style={{
          height: theme.titleBar.height || 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: theme.id === 'classic' ? 'center' : 'flex-start',
          paddingLeft: theme.id === 'classic' ? 0 : 12,
          borderBottom: theme.titleBar.borderBottom || `1px solid ${theme.border}`,
          fontWeight: theme.titleBar.fontWeight || 'bold',
          fontSize: theme.titleBar.fontSize || 12,
          background: theme.titleBarBg,
          backgroundImage: theme.titleBarBgImage,
          color: theme.titleTextColor,
          textTransform: theme.titleBar.textTransform || 'none',
          letterSpacing: theme.titleBar.letterSpacing || 'normal',
          flexShrink: 0,
        }}>
          <span style={{
            background: theme.titleTextBg,
            padding: theme.id === 'classic' ? '0 10px' : '0',
            color: theme.titleTextColor,
          }}>
            {theme.id === 'terminal' ? `── ${title} ──` : title}
          </span>
        </div>
        <div style={{ flex: 1, overflow: 'auto', background: theme.windowBg }}>
          {children}
        </div>
      </div>
    </div>
  );
}
