import { useState } from 'react';
import pincodesData from '../lib/pincodes.json';

export default function PincodeChecker() {
  const [pincode, setPincode] = useState('');
  const [status, setStatus] = useState<'idle' | 'checking' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');

  const handleCheck = () => {
    if (!/^[1-9][0-9]{5}$/.test(pincode)) {
      setStatus('error');
      setMessage('Please enter a valid 6-digit PIN code.');
      return;
    }

    setStatus('checking');
    setMessage('');

    // Simulate an API call delay for UX
    setTimeout(() => {
      // Check if the entered pincode is an exact match in our list of serviceable pincodes.
      const isServiceable = pincodesData.find((p) => p.pincode === pincode);

      if (!isServiceable) {
        setStatus('error');
        setMessage('Sorry, we do not deliver to this PIN code yet.');
      } else {
        setStatus('success');
        setMessage(`Delivery available to ${isServiceable.city}, ${isServiceable.district}.`);
        
        // Calculate mock delivery date (2 to 4 days from now)
        const date = new Date();
        const daysToAdd = Math.floor(Math.random() * 3) + 2; // 2, 3, or 4
        date.setDate(date.getDate() + daysToAdd);
        
        const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
        setDeliveryDate(`Expected delivery by ${date.toLocaleDateString('en-IN', options)}`);
      }
    }, 800);
  };

  return (
    <div className="mt-8 pt-6 border-t border-black/10">
      <div className="flex items-center gap-2 mb-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-[color:var(--color-saffron-600)]">
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
        <h3 className="font-medium text-sm">Delivery Options</h3>
      </div>
      
      <div className="flex gap-2">
        <input
          type="text"
          value={pincode}
          onChange={(e) => {
            // Only allow numbers and limit to 6 characters
            const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 6);
            setPincode(val);
            if (status !== 'idle') setStatus('idle'); // Reset on type
          }}
          placeholder="Enter 6-digit PIN code"
          className="flex-1 min-w-0 px-4 py-2.5 rounded-xl border border-black/15 text-sm outline-none focus:border-[color:var(--color-saffron-500)] focus:ring-1 focus:ring-[color:var(--color-saffron-500)] transition-all"
        />
        <button
          onClick={handleCheck}
          disabled={status === 'checking' || pincode.length !== 6}
          className="px-6 py-2.5 rounded-xl bg-black text-white text-sm font-medium hover:bg-black/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {status === 'checking' ? 'Checking...' : 'Check'}
        </button>
      </div>

      {status === 'success' && (
        <div className="mt-3 text-sm">
          <p className="text-green-700 font-medium flex items-center gap-1.5">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
            {message}
          </p>
          <p className="text-black/70 mt-0.5 ml-5">{deliveryDate}</p>
        </div>
      )}

      {status === 'error' && (
        <div className="mt-3 text-sm text-red-600 font-medium flex items-start gap-1.5">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p>{message}</p>
        </div>
      )}
    </div>
  );
}
