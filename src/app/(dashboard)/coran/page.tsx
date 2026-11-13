'use client';
import ShareAppBanner from '@/components/ShareAppBanner';

export default function CoranPage() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-gray-900">Coran</h1>
        <p className="text-gray-500 text-sm mt-1">Lecture et mémorisation</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center">
        <div className="text-6xl mb-4">📖</div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Disponible sur l&apos;application mobile</h2>
        <p className="text-gray-500 mb-6">
          La lecture et la mémorisation du Coran sont optimisées pour mobile.<br />
          Télécharge l&apos;application Sama Doom pour accéder au Coran complet avec audio.
        </p>
      </div>

      <ShareAppBanner variant="full" />

      <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
        <p className="text-blue-700 font-semibold mb-1">📊 Tes progrès sont synchronisés</p>
        <p className="text-blue-600 text-sm">
          Ta progression sur l&apos;app mobile est visible ici dans <strong>Mes progrès</strong>.
        </p>
      </div>
    </div>
  );
}
