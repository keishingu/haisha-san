'use client';

/* 新API google.maps.places.PlaceAutocompleteElement（Webコンポーネント）を使う住所サジェスト入力。
 * 旧 google.maps.places.Autocomplete は新規プロジェクトで非推奨のため移行。
 * APIキー未設定／新APIが使えない場合は通常のテキスト入力にフォールバックする。 */

import { useEffect, useRef, useState } from 'react';
import { loadMapsApi, isBrowserMapsKeyConfigured } from '@/lib/google-maps/client';
import { LatLng } from '@/lib/types';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Props = {
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect?: (location: LatLng, formattedAddress: string) => void;
  placeholder?: string;
  className?: string;
};

export default function AutocompleteInput({ value, onChange, onPlaceSelect, placeholder, className }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const innerInputRef = useRef<HTMLInputElement | null>(null);
  const elRef = useRef<any>(null);
  const [usingElement, setUsingElement] = useState(false);

  useEffect(() => {
    if (!isBrowserMapsKeyConfigured()) return;
    let cancelled = false;

    (async () => {
      try {
        await loadMapsApi();
        const places: any = (window as any).google?.maps?.places;
        if (cancelled || !containerRef.current || !places?.PlaceAutocompleteElement) return;

        const el = new places.PlaceAutocompleteElement({ includedRegionCodes: ['jp'] });
        if (className) el.className = className;
        elRef.current = el;
        containerRef.current.appendChild(el);
        setUsingElement(true);

        // 要素内の input を拾えれば、プレースホルダ・初期値・入力中テキストを扱う。
        const inner = (el.querySelector?.('input') as HTMLInputElement | null) ?? null;
        if (inner) {
          innerInputRef.current = inner;
          if (placeholder) inner.placeholder = placeholder;
          if (value) inner.value = value;
          inner.addEventListener('input', () => onChange(inner.value));
        }

        // 候補選択時: 場所の座標と整形済み住所を取得して親へ通知する。
        el.addEventListener('gmp-select', async (event: any) => {
          try {
            const prediction = event?.placePrediction ?? event?.detail?.placePrediction;
            if (!prediction) return;
            const place = prediction.toPlace();
            await place.fetchFields({ fields: ['location', 'formattedAddress'] });
            const loc = place.location;
            const addr = place.formattedAddress ?? '';
            if (loc) {
              onPlaceSelect?.({ lat: loc.lat(), lng: loc.lng() }, addr);
            }
          } catch {
            /* 詳細取得に失敗しても入力は継続できる */
          }
        });
      } catch {
        /* 新APIを初期化できない場合はフォールバックの input を使う */
      }
    })();

    return () => {
      cancelled = true;
      if (elRef.current) {
        elRef.current.remove?.();
        elRef.current = null;
      }
      innerInputRef.current = null;
      setUsingElement(false);
    };
    // 初回マウント時のみ初期化する
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 親から value が変わったら（例: サンプル読み込み）入力欄へ反映する。
  useEffect(() => {
    if (fallbackInputRef.current && fallbackInputRef.current.value !== value) {
      fallbackInputRef.current.value = value;
    }
    if (innerInputRef.current && innerInputRef.current.value !== value) {
      innerInputRef.current.value = value;
    }
  }, [value]);

  return (
    <div ref={containerRef} className={usingElement ? undefined : 'contents'}>
      {!usingElement && (
        <input
          ref={fallbackInputRef}
          type="text"
          defaultValue={value}
          onInput={() => onChange(fallbackInputRef.current?.value ?? '')}
          placeholder={placeholder}
          className={className}
          autoComplete="off"
        />
      )}
    </div>
  );
}
