'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Heart, CheckCircle, AlertCircle, Plus, X, ChevronRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';

const MALAYSIAN_STATES = [
  'Wilayah Persekutuan', 'Selangor', 'Johor', 'Pulau Pinang', 'Perak',
  'Negeri Sembilan', 'Melaka', 'Kedah', 'Kelantan', 'Terengganu',
  'Pahang', 'Perlis', 'Sabah', 'Sarawak',
];

const COMMON_CONDITIONS = [
  'Hypertension', 'Type 2 Diabetes', 'Heart Disease', 'Chronic Kidney Disease',
  'COPD / Asthma', 'Arthritis', 'Osteoporosis', 'Dementia / Alzheimer\'s',
  'Depression / Anxiety', 'Hyperlipidemia', 'Stroke (history)', 'Parkinson\'s Disease',
];

const COMMON_MEDICATIONS = [
  'Metformin', 'Amlodipine', 'Atenolol', 'Lisinopril', 'Simvastatin',
  'Aspirin', 'Warfarin', 'Omeprazole', 'Furosemide', 'Insulin',
  'Losartan', 'Glibenclamide', 'Hydrochlorothiazide', 'Prednisolone',
];

export default function OnboardPage() {
  const router = useRouter();
  const { lang } = useLanguage();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [newPatientId, setNewPatientId] = useState('');

  const [form, setForm] = useState({
    name: '',
    age: '',
    gender: 'male',
    conditions: [] as string[],
    medications: [] as string[],
    customCondition: '',
    customMedication: '',
    caregiverName: '',
    caregiverPhone: '',
    caregiverEmail: '',
    caregiverRelationship: 'Anak / Child',
    address: '',
    city: '',
    state: 'Wilayah Persekutuan',
  });

  const set = (field: string, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleCondition = (c: string) =>
    setForm((prev) => ({
      ...prev,
      conditions: prev.conditions.includes(c)
        ? prev.conditions.filter((x) => x !== c)
        : [...prev.conditions, c],
    }));

  const toggleMedication = (m: string) =>
    setForm((prev) => ({
      ...prev,
      medications: prev.medications.includes(m)
        ? prev.medications.filter((x) => x !== m)
        : [...prev.medications, m],
    }));

  const addCustomCondition = () => {
    if (form.customCondition.trim()) {
      setForm((prev) => ({
        ...prev,
        conditions: [...prev.conditions, prev.customCondition.trim()],
        customCondition: '',
      }));
    }
  };

  const addCustomMedication = () => {
    if (form.customMedication.trim()) {
      setForm((prev) => ({
        ...prev,
        medications: [...prev.medications, prev.customMedication.trim()],
        customMedication: '',
      }));
    }
  };

  const handleSubmit = async () => {
    if (!form.name || !form.age) {
      setError('Patient name and age are required.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const result = await api.createPatient({
        name: form.name,
        age: parseInt(form.age),
        gender: form.gender,
        conditions: form.conditions,
        medications: form.medications,
        caregiver: {
          name: form.caregiverName || 'Waris / Family Member',
          phone: form.caregiverPhone || '012-000 0000',
          email: form.caregiverEmail || '',
          relationship: form.caregiverRelationship,
        },
        location: {
          address: form.address || 'Malaysia',
          city: form.city || form.state,
          state: form.state,
        },
      });
      setNewPatientId(result.id);
      setSuccess(true);
    } catch (err) {
      setError('Failed to register patient. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-lg mx-auto mt-16 animate-fade-in text-center">
        <div className="glass-card p-8">
          <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            {lang === 'bm' ? 'Pesakit Berjaya Didaftarkan!' : 'Patient Registered!'}
          </h2>
          <p className="text-gray-400 mb-2">
            <span className="text-emerald-400 font-semibold">{form.name}</span>{' '}
            {lang === 'bm'
              ? 'telah ditambah ke sistem CareSphere AI. Pemantauan bermula sekarang.'
              : 'has been added to CareSphere AI. Monitoring starts now.'}
          </p>
          <p className="text-xs text-gray-500 mb-6">Patient ID: {newPatientId}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => router.push('/')}
              className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors"
            >
              {lang === 'bm' ? 'Ke Dashboard' : 'Go to Dashboard'}
            </button>
            <button
              onClick={() => { setSuccess(false); setStep(1); setForm({ name: '', age: '', gender: 'male', conditions: [], medications: [], customCondition: '', customMedication: '', caregiverName: '', caregiverPhone: '', caregiverEmail: '', caregiverRelationship: 'Anak / Child', address: '', city: '', state: 'Wilayah Persekutuan' }); }}
              className="px-5 py-2.5 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-800 font-semibold text-sm transition-colors"
            >
              {lang === 'bm' ? 'Daftar Pesakit Lain' : 'Add Another Patient'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <UserPlus className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">
              {lang === 'bm' ? 'Daftar Pesakit Baru' : 'Register New Patient'}
            </h1>
            <p className="text-gray-400 text-sm">
              {lang === 'bm' ? 'Tambah warga emas ke sistem pemantauan' : 'Onboard an elderly patient for AI monitoring'}
            </p>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mt-4">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                s === step ? 'bg-emerald-500 text-white' :
                s < step ? 'bg-emerald-500/30 text-emerald-400' :
                'bg-gray-700 text-gray-500'
              }`}>{s}</div>
              <span className={`text-xs ${s === step ? 'text-white' : 'text-gray-500'}`}>
                {s === 1 ? (lang === 'bm' ? 'Maklumat Pesakit' : 'Patient Info') :
                 s === 2 ? (lang === 'bm' ? 'Kesihatan' : 'Health Profile') :
                 (lang === 'bm' ? 'Penjaga & Lokasi' : 'Caregiver & Location')}
              </span>
              {s < 3 && <ChevronRight className="w-3 h-3 text-gray-600" />}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center gap-2 text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="glass-card p-6">
        {/* ── STEP 1: Patient Basic Info ── */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="font-semibold text-white text-sm uppercase tracking-wider text-gray-400 mb-4">
              {lang === 'bm' ? 'Maklumat Asas' : 'Basic Information'}
            </h3>

            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                {lang === 'bm' ? 'Nama Penuh *' : 'Full Name *'}
              </label>
              <input
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                placeholder={lang === 'bm' ? 'Cth: Ahmad bin Abdullah' : 'e.g. Ahmad bin Abdullah'}
                className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  {lang === 'bm' ? 'Umur *' : 'Age *'}
                </label>
                <input
                  type="number"
                  value={form.age}
                  onChange={(e) => set('age', e.target.value)}
                  placeholder="60"
                  min="40"
                  max="120"
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500 transition-colors"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">
                  {lang === 'bm' ? 'Jantina' : 'Gender'}
                </label>
                <select
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value)}
                  className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-emerald-500 transition-colors"
                >
                  <option value="male">{lang === 'bm' ? 'Lelaki' : 'Male'}</option>
                  <option value="female">{lang === 'bm' ? 'Perempuan' : 'Female'}</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: Health Profile ── */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {lang === 'bm' ? 'Penyakit Kronik' : 'Chronic Conditions'} ({form.conditions.length} {lang === 'bm' ? 'dipilih' : 'selected'})
              </h3>
              <div className="flex flex-wrap gap-2">
                {COMMON_CONDITIONS.map((c) => (
                  <button
                    key={c}
                    onClick={() => toggleCondition(c)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      form.conditions.includes(c)
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <input
                  value={form.customCondition}
                  onChange={(e) => set('customCondition', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomCondition()}
                  placeholder={lang === 'bm' ? 'Tambah penyakit lain...' : 'Add other condition...'}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
                <button onClick={addCustomCondition} className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
              {form.conditions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {form.conditions.map((c) => (
                    <span key={c} className="flex items-center gap-1 px-2 py-1 bg-emerald-500/15 text-emerald-300 rounded-lg text-xs">
                      {c}
                      <button onClick={() => toggleCondition(c)}><X className="w-3 h-3" /></button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {lang === 'bm' ? 'Ubat-ubatan' : 'Medications'} ({form.medications.length} {lang === 'bm' ? 'dipilih' : 'selected'})
              </h3>
              <div className="flex flex-wrap gap-2">
                {COMMON_MEDICATIONS.map((m) => (
                  <button
                    key={m}
                    onClick={() => toggleMedication(m)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                      form.medications.includes(m)
                        ? 'bg-blue-500/20 text-blue-400 border-blue-500/40'
                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                    }`}
                  >
                    {m}
                  </button>
                ))}
              </div>
              <div className="flex gap-2 mt-3">
                <input
                  value={form.customMedication}
                  onChange={(e) => set('customMedication', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addCustomMedication()}
                  placeholder={lang === 'bm' ? 'Tambah ubat lain...' : 'Add other medication...'}
                  className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                />
                <button onClick={addCustomMedication} className="p-2 rounded-lg bg-blue-500/20 text-blue-400 hover:bg-blue-500/30">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 3: Caregiver & Location ── */}
        {step === 3 && (
          <div className="space-y-4 animate-fade-in">
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {lang === 'bm' ? 'Maklumat Penjaga' : 'Caregiver Details'}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 mb-1 block">{lang === 'bm' ? 'Nama Penjaga' : 'Caregiver Name'}</label>
                  <input
                    value={form.caregiverName}
                    onChange={(e) => set('caregiverName', e.target.value)}
                    placeholder={lang === 'bm' ? 'Cth: Siti binti Ahmad' : 'e.g. Siti binti Ahmad'}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{lang === 'bm' ? 'No. Telefon' : 'Phone Number'}</label>
                  <input
                    value={form.caregiverPhone}
                    onChange={(e) => set('caregiverPhone', e.target.value)}
                    placeholder="012-345 6789"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{lang === 'bm' ? 'Hubungan' : 'Relationship'}</label>
                  <select
                    value={form.caregiverRelationship}
                    onChange={(e) => set('caregiverRelationship', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {['Anak / Child', 'Suami / Husband', 'Isteri / Wife', 'Adik-beradik / Sibling', 'Pengasuh / Caretaker', 'Lain-lain / Other'].map((r) => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 mb-1 block">Email</label>
                  <input
                    value={form.caregiverEmail}
                    onChange={(e) => set('caregiverEmail', e.target.value)}
                    placeholder="caregiver@email.com"
                    type="email"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {lang === 'bm' ? 'Lokasi Pesakit' : 'Patient Location'}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs text-gray-400 mb-1 block">{lang === 'bm' ? 'Alamat' : 'Address'}</label>
                  <input
                    value={form.address}
                    onChange={(e) => set('address', e.target.value)}
                    placeholder={lang === 'bm' ? 'Cth: No 5, Jalan Harmoni 3' : 'e.g. No 5, Jalan Harmoni 3'}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{lang === 'bm' ? 'Bandar' : 'City'}</label>
                  <input
                    value={form.city}
                    onChange={(e) => set('city', e.target.value)}
                    placeholder="Kuala Lumpur"
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-400 mb-1 block">{lang === 'bm' ? 'Negeri' : 'State'}</label>
                  <select
                    value={form.state}
                    onChange={(e) => set('state', e.target.value)}
                    className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                  >
                    {MALAYSIAN_STATES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6 pt-4 border-t border-gray-800">
          <button
            onClick={() => setStep((s) => s - 1)}
            disabled={step === 1}
            className="px-4 py-2 rounded-xl border border-gray-700 text-gray-400 hover:bg-gray-800 text-sm disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            {lang === 'bm' ? 'Kembali' : 'Back'}
          </button>

          {step < 3 ? (
            <button
              onClick={() => {
                if (step === 1 && !form.name) { setError('Please enter the patient name.'); return; }
                if (step === 1 && !form.age) { setError('Please enter the patient age.'); return; }
                setError('');
                setStep((s) => s + 1);
              }}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm transition-colors flex items-center gap-2"
            >
              {lang === 'bm' ? 'Seterusnya' : 'Next'}
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  {lang === 'bm' ? 'Mendaftar...' : 'Registering...'}
                </>
              ) : (
                <>
                  <Heart className="w-4 h-4" />
                  {lang === 'bm' ? 'Daftar Pesakit' : 'Register Patient'}
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Info card */}
      <div className="mt-4 glass-card p-4">
        <p className="text-xs text-gray-500 flex items-start gap-2">
          <Heart className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
          {lang === 'bm'
            ? 'Selepas pendaftaran, CareSphere AI akan mula memantau pesakit secara automatik. Data kesihatan awal akan dijana untuk membolehkan sistem AI berfungsi dengan berkesan.'
            : 'After registration, CareSphere AI will automatically start monitoring the patient. Initial baseline health data will be generated to enable accurate AI risk assessment.'}
        </p>
      </div>
    </div>
  );
}
