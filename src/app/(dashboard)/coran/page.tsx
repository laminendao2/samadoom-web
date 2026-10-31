'use client';
import { useAuth } from '@/context/AuthContext';

export default function CoranPage() {
  const { profile } = useAuth();
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
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="https://apps.apple.com" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 bg-black text-white px-5 py-3 rounded-xl font-semibold hover:bg-gray-800 transition-colors">
            <span className="text-xl">🍎</span> App Store
          </a>
          <a href="https://play.google.com" target="_blank" rel="noreferrer"
            className="flex items-center gap-2 bg-green-600 text-white px-5 py-3 rounded-xl font-semibold hover:bg-green-700 transition-colors">
            <span className="text-xl">🤖</span> Google Play
          </a>
        </div>
      </div>
      {/* Progrès rapide */}
      <div className="bg-blue-50 rounded-2xl p-5 border border-blue-100">
        <p className="text-blue-700 font-semibold mb-1">📊 Tes progrès sont synchronisés</p>
        <p className="text-blue-600 text-sm">
          Ta progression sur l&apos;app mobile est visible ici dans <strong>Mes progrès</strong>.
        </p>
      </div>
    </div>
  );
}
