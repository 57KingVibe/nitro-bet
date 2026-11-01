import React from 'react';

const NAMES: Record<string, string> = { discord: 'Discord', x: 'X', instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', linkedin: 'LinkedIn', medium: 'Medium' };
const ORDER = ['discord', 'x', 'instagram', 'tiktok', 'facebook', 'linkedin', 'medium'];

/** Only the links you have set (in Render) are shown. */
const SocialLinks: React.FC<{ links: Record<string, string> | undefined }> = ({ links }) => {
  const shown = ORDER.filter((k) => links?.[k]);
  if (shown.length === 0) return null;
  return (
    <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-5 text-center" data-testid="social-links">
      <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-3">Follow us</p>
      <div className="flex flex-wrap justify-center gap-2">
        {shown.map((k) => (
          <a key={k} href={links![k]} target="_blank" rel="noopener noreferrer"
             className="px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 hover:border-red-500 text-[10px] font-black uppercase text-slate-300 hover:text-white">
            {NAMES[k]}
          </a>
        ))}
      </div>
    </div>
  );
};

export default SocialLinks;
