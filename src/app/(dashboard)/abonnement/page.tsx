'use client';
import { useAuth } from '@/context/AuthContext';

const PLANS = [
  {
    id: 'mensuel',
    name: 'Mensuel',
    price: '4.99',
    currency: '€',
    period: '/mois',
    features: ['Accès à tout le Coran', 'Cours illimités', 'Suivi des progrès', 'Support prioritaire'],
    highlight: false,
  },
  {
    id: 'annuel',
    name: 'Annuel',
    price: '39.99',
    currency: '€',
    period: '/an',
    badge: 'Économise 33%',
    features: ['Tout du plan Mensuel', '2 mois offerts', 'Accès famille (2 enfants)', 'Contenu exclusif'],
    highlight: true,
  },
];

export default function AbonnementPage() {
  const { profile } = useAuth();

  return (
    <div className="p-8 max-w-3xl">
      <h1 className="text-2xl font-black text-gray-900 mb-2">Abonnement Pro</h1>
      <p className="text-gray-500 mb-8">Débloquez tout le contenu islamique pour vous et votre famille.</p>
      {profile?.isPro && (
        <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
          <span className="text-2xl">⭐</span>
          <div>
            <p className="font-bold text-green-800">Vous avez déjà le Plan Pro !</p>
            <p className="text-sm text-green-700">Profitez de tout le contenu sans restriction.</p>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        {PLANS.map(plan => (
          <div key={plan.id}
            className={`relative bg-white rounded-2xl p-6 border-2 transition-all ${
              plan.highlight ? 'border-green-600 shadow-lg shadow-green-100' : 'border-gray-200 shadow-sm'
            }`}>
            {plan.badge && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-green-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                {plan.badge}
              </div>
            )}
            <h3 className="font-black text-xl text-gray-900">{plan.name}</h3>
            <div className="flex items-baseline gap-1 mt-3 mb-6">
              <span className="text-4xl font-black text-gray-900">{plan.currency}{plan.price}</span>
              <span className="text-gray-500">{plan.period}</span>
            </div>
            <ul className="space-y-2 mb-6">
              {plan.features.map(f => (
                <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="text-green-600">✓</span> {f}
                </li>
              ))}
            </ul>
            <button
              className={`w-full py-3 font-bold rounded-xl transition-colors ${
                plan.highlight ? 'bg-green-700 text-white hover:bg-green-800' : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
              }`}
              onClick={() => alert('Paiement en cours d\'intégration — Stripe & PayDunya bientôt disponibles !')}>
              {profile?.isPro ? 'Plan actuel' : `Choisir ${plan.name}`}
            </button>
          </div>
        ))}
      </div>
      <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6">
        <h3 className="font-bold text-orange-800 mb-2">🌍 Paiement Afrique de l&apos;Ouest</h3>
        <p className="text-sm text-orange-700 mb-3">
          Bientôt disponible via <strong>PayDunya</strong> — Orange Money, Wave, Free Money et plus.
        </p>
        <button className="px-4 py-2 bg-orange-600 text-white text-sm font-bold rounded-lg hover:bg-orange-700 transition-colors"
          onClick={() => alert('PayDunya sera intégré prochainement !')}>
          Être notifié
        </button>
      </div>
    </div>
  );
}
