'use client';

import { useRef, useEffect } from 'react';
import { loadMapsApi, isBrowserMapsKeyConfigured } from '@/lib/google-maps/client';
import { LatLng } from '@/lib/types';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (location: LatLng, formattedAddress: string) => void;
  placeholder?: string;
  className?: string;
};

// 住所サジェスト入力。ブラウザ用キーが未設定なら通常のテキスト入力として動作する。
export default function AutocompleteInput({ value, onChange, onPlaceSelect, placeholder, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isBrowserMapsKeyConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    loadMapsApi().then(() => {
      if (!inputRef.current || !window.google?.maps?.places) return;

      const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: 'jp' },
        fields: ['formatted_address', 'geometry.location'],
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (place?.geometry?.location && place.formatted_address) {
          onPlaceSelect?.(
            { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() },
            place.formatted_address
          );
        }
      });
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  return (
    <input
      ref={inputRef}
      type="text"
      defaultValue={value}
      onInput={() => onChange(inputRef.current?.value ?? '')}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  );
}
