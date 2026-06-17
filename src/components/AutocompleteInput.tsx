import { useRef, useEffect, useState } from 'react';
import { loadMapsApi, isApiKeyConfigured } from '../utils/googleMapsApi';
import { LatLng } from '../types';

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (location: LatLng, formattedAddress: string) => void;
  placeholder?: string;
  className?: string;
};

export default function AutocompleteInput({ value, onChange, onPlaceSelect, placeholder, className }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isApiKeyConfigured() || !inputRef.current || initializedRef.current) return;
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
          onChange(place.formatted_address);
          onPlaceSelect?.(
            {
              lat: place.geometry.location.lat(),
              lng: place.geometry.location.lng(),
            },
            place.formatted_address
          );
        }
      });

      setReady(true);
    }).catch(() => {
      // API読み込み失敗
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 外部からのvalue変更を反映（サンプルデータ読み込み時など）
  useEffect(() => {
    if (inputRef.current && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value]);

  const handleInput = () => {
    onChange(inputRef.current?.value ?? '');
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        defaultValue={value}
        onInput={handleInput}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {ready && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500 text-xs">
          ✓
        </div>
      )}
    </div>
  );
}
