import React, { useState, useRef, useEffect } from 'react';
import { useScanStore } from '../store/scanStore';
import './ThemeSwitcher.css';

const themes = [
  { id: 'default', name: 'Default', swatch: '#0066cc' },
  { id: 'night-blue', name: 'Night Blue', swatch: '#58a6ff' },
  { id: 'red-black', name: 'Red/Black', swatch: '#ff4444' },
  { id: 'green-black', name: 'Green/Black', swatch: '#44cc44' },
  { id: 'purple-light', name: 'Purple Light', swatch: '#7b2ff5' },
  { id: 'purple-dark', name: 'Purple Dark', swatch: '#9966ff' },
];

function ThemeSwitcher() {
  const { theme, setTheme } = useScanStore();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelect = (id) => {
    setTheme(id);
    setOpen(false);
  };

  return (
    <div className="theme-switcher" ref={ref}>
      <button
        className="theme-trigger"
        onClick={() => setOpen((prev) => !prev)}
        title="Switch theme"
      >
        <span className="mini-swatches">
          <span style={{ background: '#0066cc' }} />
          <span style={{ background: '#58a6ff' }} />
          <span style={{ background: '#ff4444' }} />
          <span style={{ background: '#44cc44' }} />
        </span>
      </button>
      {open && (
        <div className="theme-dropdown">
          {themes.map((t) => (
            <div
              key={t.id}
              className={`theme-option ${theme === t.id ? 'active' : ''}`}
              onClick={() => handleSelect(t.id)}
            >
              <span className="swatch" style={{ background: t.swatch }} />
              <span className="theme-name">{t.name}</span>
              {theme === t.id && <span className="check">✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ThemeSwitcher;
