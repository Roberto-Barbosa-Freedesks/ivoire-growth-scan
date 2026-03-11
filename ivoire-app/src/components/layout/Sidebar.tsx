import { NavLink, useNavigate } from 'react-router-dom';
import { useAppStore } from '../../store/store';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const DashboardIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { path: '/settings', label: 'Configurações', icon: <SettingsIcon /> },
];

export default function Sidebar() {
  const { user, logout, diagnostics } = useAppStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const completedCount = diagnostics.filter(d => d.status === 'completed').length;
  const totalCount = diagnostics.length;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  return (
    <aside
      style={{
        width: '240px',
        minHeight: '100vh',
        background: 'rgba(0,0,0,0.4)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
      }}
    >
      {/* Logo Area */}
      <div
        style={{
          padding: '32px 24px 28px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <img
          src={`${import.meta.env.BASE_URL}ivoire-logo-yellow.png`}
          alt="Ivoire"
          style={{ width: '120px', height: 'auto', display: 'block', marginBottom: '6px' }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div
          className="font-montserrat"
          style={{
            fontSize: '10px',
            fontWeight: 700,
            color: '#FFFF02',
            letterSpacing: '3px',
            marginTop: '2px',
          }}
        >
          GROWTH SCAN
        </div>
        <div
          className="font-mono-display"
          style={{
            fontSize: '9px',
            color: '#c9c9c9',
            letterSpacing: '1px',
            marginTop: '6px',
          }}
        >
          diagnostic engine v1.0
        </div>
      </div>

      {/* Stats mini strip */}
      <div
        style={{
          padding: '16px 24px',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
          display: 'flex',
          gap: '16px',
        }}
      >
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div
            className="font-bebas"
            style={{ fontSize: '24px', color: '#FFFF02', lineHeight: 1 }}
          >
            {totalCount}
          </div>
          <div
            style={{ fontSize: '9px', color: '#c9c9c9', fontFamily: 'Montserrat', fontWeight: 600, letterSpacing: '0.5px', marginTop: '2px' }}
          >
            TOTAL
          </div>
        </div>
        <div
          style={{
            width: '1px',
            background: 'rgba(255,255,255,0.06)',
          }}
        />
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div
            className="font-bebas"
            style={{ fontSize: '24px', color: '#00cc66', lineHeight: 1 }}
          >
            {completedCount}
          </div>
          <div
            style={{ fontSize: '9px', color: '#c9c9c9', fontFamily: 'Montserrat', fontWeight: 600, letterSpacing: '0.5px', marginTop: '2px' }}
          >
            CONCLUÍDOS
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '16px 12px' }}>
        <div
          style={{
            fontSize: '9px',
            fontFamily: 'Montserrat',
            fontWeight: 700,
            color: '#c9c9c9',
            letterSpacing: '1.5px',
            padding: '0 12px',
            marginBottom: '8px',
          }}
        >
          MENU
        </div>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {NAV_ITEMS.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 12px',
                  borderRadius: '6px',
                  textDecoration: 'none',
                  fontFamily: 'Montserrat',
                  fontSize: '13px',
                  fontWeight: isActive ? 700 : 500,
                  color: isActive ? '#FFFF02' : '#999999',
                  background: isActive ? 'rgba(255,255,2,0.08)' : 'transparent',
                  borderLeft: isActive ? '2px solid #FFFF02' : '2px solid transparent',
                  transition: 'all 0.15s ease',
                })}
              >
                {({ isActive }) => (
                  <>
                    <span style={{ color: isActive ? '#FFFF02' : '#777', flexShrink: 0 }}>
                      {item.icon}
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>

        {/* Framework 4Cs reference */}
        <div
          style={{
            marginTop: '32px',
            padding: '12px',
            background: 'rgba(255,255,2,0.04)',
            border: '1px solid rgba(255,255,2,0.1)',
            borderRadius: '6px',
          }}
        >
          <div
            style={{
              fontSize: '9px',
              fontFamily: 'Montserrat',
              fontWeight: 700,
              color: '#FFFF02',
              letterSpacing: '1.5px',
              marginBottom: '10px',
            }}
          >
            FRAMEWORK 4Cs
          </div>
          {[
            { key: 'C', label: 'Conteúdo', color: '#FFFF02' },
            { key: 'C', label: 'Canais', color: '#FFFF02' },
            { key: 'C', label: 'Conversão', color: '#FFFF02' },
            { key: 'C', label: 'Controle', color: '#FFFF02' },
          ].map((dim, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '5px',
              }}
            >
              <div
                className="font-bebas"
                style={{
                  width: '16px',
                  height: '16px',
                  background: 'rgba(255,255,2,0.15)',
                  borderRadius: '2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  color: dim.color,
                  flexShrink: 0,
                }}
              >
                {dim.key}
              </div>
              <span
                style={{
                  fontSize: '11px',
                  color: '#999999',
                  fontFamily: 'Arvo',
                }}
              >
                {dim.label}
              </span>
            </div>
          ))}
        </div>
      </nav>

      {/* User info at bottom */}
      <div
        style={{
          padding: '16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            {/* Avatar */}
            <div
              className="font-montserrat"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(255,255,2,0.15)',
                border: '1px solid rgba(255,255,2,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: 700,
                color: '#FFFF02',
                flexShrink: 0,
              }}
            >
              {getInitials(user.name)}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: '13px',
                  fontFamily: 'Montserrat',
                  fontWeight: 600,
                  color: '#ffffff',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user.name}
              </div>
              <div
                style={{
                  fontSize: '10px',
                  color: '#c9c9c9',
                  fontFamily: 'Arvo',
                  textTransform: 'capitalize',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {user.role}
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleLogout}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            width: '100%',
            padding: '8px 10px',
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '4px',
            color: '#999',
            fontSize: '12px',
            fontFamily: 'Montserrat',
            fontWeight: 500,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = '#ff4d4d';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,77,77,0.3)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = '#999';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
          }}
        >
          <LogoutIcon />
          Sair
        </button>
      </div>
    </aside>
  );
}
