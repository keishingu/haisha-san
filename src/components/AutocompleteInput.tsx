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
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [ready, setReady] = useState(false);
  const [inputHidden, setInputHidden] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!isApiKeyConfigured() || initializedRef.current) return;
    initializedRef.current = true;

    loadMapsApi().then(() => {
      if (!window.google?.maps?.places) return;

      if (typeof google.maps.places.PlaceAutocompleteElement === 'function') {
        try {
          const pac = document.createElement('gmp-place-autocomplete');
          pac.setAttribute('country', 'jp');

          pac.addEventListener('gmp-placeselect', ((event: Event) => {
            const e = event as { place?: { location?: { lat: () => number; lng: () => number }; formattedAddress?: string } };
            const place = e.place;
            if (place?.location && place.formattedAddress) {
              onChange(place.formattedAddress);
              onPlaceSelect?.(
                { lat: place.location.lat(), lng: place.location.lng() },
                place.formattedAddress
              );
            }
          }) as EventListener);

          if (inputRef.current) {
            inputRef.current.style.display = 'none';
            inputRef.current.parentElement?.appendChild(pac);
          }
          setInputHidden(true);
          setReady(true);
          return;
        } catch {
          // PlaceAutocompleteElement が使えない場合はフォールバック
        }
      }

      if (inputRef.current) {
        const autocomplete = new google.maps.places.Autocomplete(inputRef.current, {
          componentRestrictions: { country: 'jp' },
          fields: ['formatted_address', 'geometry.location'],
        });

        autocomplete.addListener('place_changed', () => {
          const place = autocomplete.getPlace();
          if (place?.geometry?.location && place.formatted_address) {
            onChange(place.formatted_address);
            onPlaceSelect?.(
              { lat: place.geometry.location.lat(), lng: place.geometry.location.lng() },
              place.formatted_address
            );
          }
        });
        setReady(true);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (inputRef.current && !inputHidden && inputRef.current.value !== value) {
      inputRef.current.value = value;
    }
  }, [value, inputHidden]);

  return (
    <div ref={wrapperRef} className="relative">
      {!inputHidden && (
        <input
          ref={inputRef}
          type="text"
          defaultValue={value}
          onInput={() => onChange(inputRef.current?.value ?? '')}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
        />
      )}
      {ready && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2 text-green-500 text-xs">✓</div>
      )}
    </div>
  );
}
