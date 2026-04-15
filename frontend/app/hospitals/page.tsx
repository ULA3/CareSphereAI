'use client';

import { useState, useEffect } from 'react';
import { MapPin, Phone, Clock, AlertCircle, ChevronDown, Building2, Ambulance } from 'lucide-react';
import { api, HospitalData, Patient } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

export default function HospitalsPage() {
  const { t } = useLanguage();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState('');
  const [hospitalData, setHospitalData] = useState<HospitalData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.getPatients().then((ps) => {
      setPatients(ps);
      if (ps.length > 0) {
        setSelectedPatientId(ps[0].id);
      }
    });
  }, []);

  useEffect(() => {
    if (!selectedPatientId) return;
    setLoading(true);
    api.getHospitals(selectedPatientId)
      .then(setHospitalData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedPatientId]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t.hospitals}</h1>
          <p className="text-slate-500 mt-1 text-sm">Nearby Malaysian hospitals and emergency facilities</p>
        </div>
        <div className="relative">
          <select
            value={selectedPatientId}
            onChange={(e) => setSelectedPatientId(e.target.value)}
            className="appearance-none border border-slate-200 rounded-lg px-3 py-2 pr-8 text-sm text-slate-900 bg-white focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {p.location.city}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-500 rounded-full animate-spin" />
        </div>
      ) : hospitalData ? (
        <>
          {/* Emergency Banner */}
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
              <Ambulance className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-semibold text-red-700">Emergency Contact: {hospitalData.emergencyContact}</p>
              <p className="text-sm text-red-600">
                Recommended: <span className="font-semibold">{hospitalData.recommendedHospital}</span> · Est. travel: {hospitalData.estimatedTravelTime}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Hospital List */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-teal-600" />
                Nearby Hospitals ({hospitalData.patientCity}, {hospitalData.patientState})
              </h2>
              {hospitalData.hospitals.map((hospital, idx) => (
                <div
                  key={hospital.id}
                  className={`bg-white rounded-xl border shadow-card p-4 transition-all hover:scale-[1.01] ${
                    idx === 0 ? 'border-teal-200' : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        {idx === 0 && (
                          <span className="text-xs bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded-full font-semibold">
                            Recommended
                          </span>
                        )}
                        <h3 className="font-semibold text-slate-900 text-sm">{hospital.name}</h3>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{hospital.address}, {hospital.city}</p>
                    </div>
                    {hospital.emergencyAvailable && (
                      <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full shrink-0">
                        24h A&E
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-teal-600" />
                      {hospital.distance}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-brand-500" />
                      {hospital.type}
                    </span>
                    <a href={`tel:${hospital.phone}`} className="flex items-center gap-1 text-teal-600 hover:text-teal-700 transition-colors ml-auto">
                      <Phone className="w-3 h-3" />
                      {hospital.phone}
                    </a>
                  </div>
                </div>
              ))}
            </div>

            {/* Map Panel */}
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-brand-500" />
                Hospital Map
              </h2>

              {/* SVG map — fully self-contained, no external requests */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-card" style={{ height: '420px' }}>
                <svg
                  width="100%"
                  height="100%"
                  viewBox="0 0 600 420"
                  xmlns="http://www.w3.org/2000/svg"
                  style={{ display: 'block', borderRadius: '12px', background: '#F8FAFC' }}
                >
                  {/* Grid lines */}
                  {Array.from({ length: 15 }).map((_, i) => (
                    <line key={`h${i}`} x1="0" y1={i * 30} x2="600" y2={i * 30} stroke="rgba(0,0,0,0.04)" strokeWidth="1" />
                  ))}
                  {Array.from({ length: 21 }).map((_, i) => (
                    <line key={`v${i}`} x1={i * 30} y1="0" x2={i * 30} y2="420" stroke="rgba(0,0,0,0.04)" strokeWidth="1" />
                  ))}

                  {/* Roads */}
                  <line x1="0" y1="168" x2="600" y2="168" stroke="#0d9488" strokeWidth="2.5" strokeOpacity="0.2" />
                  <line x1="0" y1="273" x2="600" y2="273" stroke="#0d9488" strokeWidth="1.5" strokeOpacity="0.12" />
                  <line x1="180" y1="0" x2="180" y2="420" stroke="#0d9488" strokeWidth="2.5" strokeOpacity="0.2" />
                  <line x1="360" y1="0" x2="360" y2="420" stroke="#0d9488" strokeWidth="1.5" strokeOpacity="0.12" />
                  <line x1="90" y1="0" x2="330" y2="420" stroke="#0d9488" strokeWidth="1" strokeOpacity="0.08" strokeDasharray="6,10" />
                  <line x1="270" y1="0" x2="510" y2="420" stroke="#0d9488" strokeWidth="1" strokeOpacity="0.08" strokeDasharray="6,10" />

                  {/* City label */}
                  <rect x="12" y="12" width="160" height="28" rx="6" fill="#fff" stroke="#E2E8F0" strokeWidth="1" />
                  <circle cx="28" cy="26" r="5" fill="#0d9488" />
                  <text x="38" y="30" fill="#334155" fontSize="11" fontWeight="600" fontFamily="sans-serif">
                    {hospitalData.patientCity}, Malaysia
                  </text>

                  {/* Hospital pins */}
                  {(() => {
                    const positions = [
                      { x: 180, y: 160 },
                      { x: 348, y: 218 },
                      { x: 108, y: 252 },
                      { x: 432, y: 126 },
                      { x: 270, y: 286 },
                      { x: 372, y: 84  },
                    ];
                    return hospitalData.hospitals.slice(0, 6).map((hospital, idx) => {
                      const pos = positions[idx] ?? { x: 120 + idx * 70, y: 150 + idx * 40 };
                      const isFirst = idx === 0;
                      const color = isFirst ? '#0d9488' : '#ef4444';
                      const labelX = pos.x > 480 ? pos.x - 8 : pos.x + 14;
                      const labelAnchor = pos.x > 480 ? 'end' : 'start';
                      const shortName = hospital.name.length > 22 ? hospital.name.slice(0, 21) + '…' : hospital.name;
                      return (
                        <g key={hospital.id}>
                          {/* Pin stem */}
                          <line x1={pos.x} y1={pos.y} x2={pos.x} y2={pos.y + 14} stroke={color} strokeWidth="1.5" strokeOpacity="0.8" />
                          {/* Pin circle */}
                          <circle cx={pos.x} cy={pos.y} r="12" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5" />
                          <circle cx={pos.x} cy={pos.y} r="7" fill={color} />
                          {/* Index number */}
                          <text x={pos.x} y={pos.y + 4} textAnchor="middle" fill="white" fontSize="8" fontWeight="700" fontFamily="sans-serif">
                            {idx + 1}
                          </text>
                          {/* Name label */}
                          <rect
                            x={labelAnchor === 'start' ? labelX - 2 : labelX - hospital.name.slice(0, 22).length * 5.5}
                            y={pos.y - 9}
                            width={Math.min(hospital.name.length, 22) * 5.5 + 8}
                            height="16"
                            rx="3"
                            fill="#fff"
                            fillOpacity="0.9"
                            stroke="#E2E8F0"
                            strokeWidth="0.5"
                          />
                          <text x={labelX} y={pos.y + 3} textAnchor={labelAnchor} fill="#334155" fontSize="9.5" fontFamily="sans-serif">
                            {shortName}
                          </text>
                          {hospital.emergencyAvailable && (
                            <text x={labelX} y={pos.y + 15} textAnchor={labelAnchor} fill="#dc2626" fontSize="8" fontFamily="sans-serif">
                              24h A&E
                            </text>
                          )}
                        </g>
                      );
                    });
                  })()}

                  {/* Legend */}
                  <rect x="12" y="378" width="138" height="34" rx="6" fill="#fff" stroke="#E2E8F0" strokeWidth="1" />
                  <circle cx="26" cy="390" r="5" fill="#0d9488" />
                  <text x="36" y="394" fill="#475569" fontSize="10" fontFamily="sans-serif">Recommended</text>
                  <circle cx="26" cy="405" r="5" fill="#ef4444" />
                  <text x="36" y="409" fill="#475569" fontSize="10" fontFamily="sans-serif">Other hospitals</text>

                  {/* Open Maps link area */}
                  <rect x="462" y="390" width="126" height="22" rx="6" fill="#2563eb" />
                  <text x="525" y="405" textAnchor="middle" fill="white" fontSize="10" fontWeight="600" fontFamily="sans-serif">
                    ↗ Open in Maps
                  </text>
                  {/* invisible clickable overlay */}
                  <a href={`https://www.google.com/maps/search/hospital+near+${encodeURIComponent(hospitalData.patientCity + ' Malaysia')}`} target="_blank" rel="noopener noreferrer">
                    <rect x="462" y="390" width="126" height="22" rx="6" fill="transparent" cursor="pointer" />
                  </a>
                </svg>
              </div>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-center gap-2 text-amber-700 mb-2">
                  <AlertCircle className="w-4 h-4" />
                  <p className="text-sm font-semibold">Emergency Protocol</p>
                </div>
                <ul className="text-xs text-amber-700/80 space-y-1">
                  <li>• Call <span className="text-red-700 font-semibold">999</span> for life-threatening emergencies</li>
                  <li>• Hospital emergency line: <span className="text-teal-700">{hospitalData.emergencyContact}</span></li>
                  <li>• Alert caregiver immediately before hospital transport</li>
                  <li>• Bring medication list to A&E department</li>
                  <li>• CareSphere AI has pre-prepared patient medical summary</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-12 text-slate-400">{t.noData}</div>
      )}
    </div>
  );
}
