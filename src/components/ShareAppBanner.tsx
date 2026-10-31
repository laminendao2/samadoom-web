'use client';
import { useState } from 'react';

const APP_STORE_URL = 'https://apps.apple.com/ca/app/sama-doom/id6739324174?l=fr-CA';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mycompany.daara&pcampaignid=web_share';

interface ShareAppBannerProps {
  variant?: 'full' | 'compact';
}

export default function ShareAppBanner({ variant = 'full' }: ShareAppBannerProps) {
  const [copied, setCopied] = useState(false);

  const shareNative = async () => {
    const text = `📖 Sama Doom – L'application d'éducation islamique\n\n🍎 App Store : ${APP_STORE_URL}\n🤖 Play Store : ${PLAY_STORE_URL}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Sama Doom', text, url: APP_STORE_URL });
        return;
      } catch {}
    }
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (variant === 'compact') {
    return (
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4">
        <span className="text-3xl">📲</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-gray-900 text-sm">Partager l&apos;application</p>
          <p className="text-gray-500 text-xs truncate">Invitez famille et amis à rejoindre Sama Doom</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <a href={APP_STORE_URL} target="_blank" rel="noreferrer"
            className="bg-black text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-1">
            🍎 iOS
          </a>
          <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer"
            className="bg-green-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-1">
            🤖 Android
          </a>
          <button onClick={shareNative}
            className="bg-blue-600 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-blue-700 transition-colors">
            {copied ? '✅' : '🔗'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-emerald-600 to-teal-700 rounded-2xl p-6 text-white">
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-3xl flex-shrink-0">
          📖
        </div>
        <div className="flex-1">
          <h3 className="font-black text-lg">Partager Sama Doom</h3>
          <p className="text-white/80 text-sm mt-1">
            Invitez vos proches à apprendre le Coran et l&apos;islam avec Sama Doom
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-3 mt-5">
        <a href={APP_STORE_URL} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 bg-black/40 hover:bg-black/60 border border-white/20 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors">
          <span className="text-lg">🍎</span>
          <div className="text-left">
            <div className="text-[10px] text-white/70 leading-none">Télécharger sur</div>
            <div className="font-bold leading-tight">App Store</div>
          </div>
        </a>
        <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer"
          className="flex items-center gap-2 bg-black/40 hover:bg-black/60 border border-white/20 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors">
          <span className="text-lg">🤖</span>
          <div className="text-left">
            <div className="text-[10px] text-white/70 leading-none">Disponible sur</div>
            <div className="font-bold leading-tight">Google Play</div>
          </div>
        </a>
        <button onClick={shareNative}
          className="flex items-center gap-2 bg-white/20 hover:bg-white/30 border border-white/20 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition-colors">
          <span className="text-lg">{copied ? '✅' : '🔗'}</span>
          <span>{copied ? 'Lien copié !' : 'Copier le lien'}</span>
        </button>
      </div>
    </div>
  );
}
