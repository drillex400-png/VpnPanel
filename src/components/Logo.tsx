import React from "react";

/**
 * PanelVPN's own mark -- a hexagonal badge (echoes a relay/network node, not a generic
 * padlock-and-shield) with a hub-and-spoke glyph inside representing a VPN server fanning
 * connections out to its clients. Replaces the stock lucide Shield/Server icon that was
 * previously standing in as "the logo" everywhere -- every other AI-built dashboard reaches
 * for the exact same icon library, so this is one of the highest-leverage ways to stop
 * looking like a generic template. Pure vector, so it stays crisp from a 16px favicon up to
 * a large login-screen badge.
 */
export const Logo: React.FC<{ className?: string }> = ({ className = "w-6 h-6" }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="panelvpn-logo-grad" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#8b5cf6" />
        <stop offset="100%" stopColor="#d946ef" />
      </linearGradient>
    </defs>
    {/* Hexagonal badge outline */}
    <path
      d="M12 2.3L20.3 7.1V16.9L12 21.7L3.7 16.9V7.1L12 2.3Z"
      stroke="url(#panelvpn-logo-grad)"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    {/* Hub-and-spoke relay glyph */}
    <line x1="12" y1="13.2" x2="8.4" y2="9.2" stroke="url(#panelvpn-logo-grad)" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="12" y1="13.2" x2="15.6" y2="9.2" stroke="url(#panelvpn-logo-grad)" strokeWidth="1.2" strokeLinecap="round" />
    <line x1="12" y1="13.2" x2="12" y2="17.6" stroke="url(#panelvpn-logo-grad)" strokeWidth="1.2" strokeLinecap="round" />
    <circle cx="8.4" cy="9.2" r="1.5" fill="#d946ef" />
    <circle cx="15.6" cy="9.2" r="1.5" fill="#8b5cf6" />
    <circle cx="12" cy="17.6" r="1.5" fill="#a78bfa" />
    <circle cx="12" cy="13.2" r="2" fill="url(#panelvpn-logo-grad)" />
  </svg>
);
