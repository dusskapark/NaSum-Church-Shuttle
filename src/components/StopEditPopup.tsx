import { useState, useEffect } from 'react';
import {
  Button,
  Form,
  Input,
  Picker,
  Popup,
  Switch,
  TextArea,
  Toast,
} from 'antd-mobile';

type PickerValue = string | number | null;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface StopEditValues {
  displayName: string | null;
  isTerminal: boolean;
  pickupTime: string;
  notes: string;
  isPickupEnabled: boolean;
  googlePlaceId: string;
  stopId: string;
}

export interface PlaceLookupResult {
  name: string;
  displayName: string | null;
  stopId: string | null;
  isTerminal: boolean;
}

interface StopEditPopupProps {
  visible: boolean;
  /** Original place.name shown as label / placeholder */
  stopName: string;
  initialValues: StopEditValues;
  saving: boolean;
  onSave: (values: StopEditValues) => void;
  /** Fetch place info by google_place_id. Returns result to pre-populate fields. */
  onFetchPlace?: (googlePlaceId: string) => Promise<PlaceLookupResult | null>;
  onClose: () => void;
  lang: string;
}

// ── Picker columns ────────────────────────────────────────────────────────────

const HOUR_COLS = Array.from({ length: 12 }, (_, i) => ({
  label: String(i + 1),
  value: String(i + 1),
}));

const MINUTE_COLS = Array.from({ length: 60 }, (_, i) => ({
  label: i.toString().padStart(2, '0'),
  value: i.toString().padStart(2, '0'),
}));

const AMPM_COLS = [
  { label: 'AM', value: 'AM' },
  { label: 'PM', value: 'PM' },
];

const TIME_COLUMNS = [HOUR_COLS, MINUTE_COLS, AMPM_COLS];
const DEFAULT_PICKER_VALUE: PickerValue[] = ['8', '00', 'AM'];

function parseTimeToPickerValue(time: string): PickerValue[] | undefined {
  const match = time.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return undefined;
  return [match[1], match[2].padStart(2, '0'), match[3].toUpperCase()];
}

function formatPickerValueToTime(val: PickerValue[]): string {
  const [h, m, ampm] = val;
  if (!h || !m || !ampm) return '';
  return `${h}:${m} ${ampm}`;
}

// ── Strings ───────────────────────────────────────────────────────────────────

const STRINGS = {
  en: {
    title: 'Edit Stop',
    displayName: 'Display name',
    googlePlaceId: 'Google Place ID',
    stopId: 'Bus stop ID',
    isTerminal: 'Terminal stop',
    pickupTime: 'Pickup time',
    pickupTimePlaceholder: 'Tap to set time',
    pickupEnabled: 'Pickup enabled',
    routeNotes: 'Route notes',
    confirm: 'Confirm',
    save: 'Save',
    cancel: 'Cancel',
    fetch: 'Fetch',
    fetchError: 'Place not found.',
  },
  ko: {
    title: '정류장 편집',
    displayName: '표시 이름',
    googlePlaceId: 'Google Place ID',
    stopId: '버스 정류소 ID',
    isTerminal: '최종 목적지 (Terminal)',
    pickupTime: '탑승 시간',
    pickupTimePlaceholder: '시간을 선택하세요',
    pickupEnabled: '탑승 활성',
    routeNotes: '노선 메모',
    confirm: '확인',
    save: '저장',
    cancel: '취소',
    fetch: 'Fetch',
    fetchError: '장소를 찾을 수 없습니다.',
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function StopEditPopup({
  visible,
  stopName,
  initialValues,
  saving,
  onSave,
  onFetchPlace,
  onClose,
  lang,
}: StopEditPopupProps) {
  const t = STRINGS[lang === 'ko' ? 'ko' : 'en'];

  const [values, setValues] = useState<StopEditValues>(initialValues);
  const [fetchingPlace, setFetchingPlace] = useState(false);

  // Reset form whenever popup opens with new data
  useEffect(() => {
    if (visible) setValues(initialValues);
  }, [visible, initialValues]);

  const handleFetch = async () => {
    if (!onFetchPlace || !values.googlePlaceId.trim()) return;
    setFetchingPlace(true);
    try {
      const result = await onFetchPlace(values.googlePlaceId.trim());
      if (result) {
        setValues((v) => ({
          ...v,
          displayName: result.displayName,
          stopId: result.stopId ?? '',
          isTerminal: result.isTerminal,
        }));
      } else {
        Toast.show({ content: t.fetchError, icon: 'fail' });
      }
    } catch {
      Toast.show({ content: t.fetchError, icon: 'fail' });
    } finally {
      setFetchingPlace(false);
    }
  };

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      position="bottom"
      bodyStyle={{ maxHeight: '85vh', overflowY: 'auto' }}
    >
      <div style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <Form
          layout="horizontal"
          style={{ '--prefix-width': '8.5em' } as React.CSSProperties}
        >
          {/* Display name */}
          <Form.Item label={t.displayName}>
            <Input
              placeholder={stopName}
              value={values.displayName ?? ''}
              onChange={(val) =>
                setValues((v) => ({ ...v, displayName: val || null }))
              }
            />
          </Form.Item>

          {/* Google Place ID */}
          <Form.Item
            label={t.googlePlaceId}
            extra={
              onFetchPlace && (
                <a
                  style={{
                    fontSize: 13,
                    paddingLeft: 8,
                    color: fetchingPlace
                      ? 'var(--adm-color-weak)'
                      : 'var(--adm-color-primary)',
                    pointerEvents: fetchingPlace ? 'none' : 'auto',
                  }}
                  onClick={() => {
                    handleFetch().catch(() => {});
                  }}
                >
                  {fetchingPlace ? '…' : t.fetch}
                </a>
              )
            }
          >
            <Input
              placeholder="ChIJ..."
              value={values.googlePlaceId}
              onChange={(val) =>
                setValues((v) => ({ ...v, googlePlaceId: val }))
              }
            />
          </Form.Item>

          {/* Bus stop ID */}
          <Form.Item label={t.stopId}>
            <Input
              placeholder="13121"
              value={values.stopId}
              onChange={(val) => setValues((v) => ({ ...v, stopId: val }))}
            />
          </Form.Item>

          {/* Pickup time — Picker */}
          <Picker
            columns={TIME_COLUMNS}
            value={parseTimeToPickerValue(values.pickupTime)}
            defaultValue={DEFAULT_PICKER_VALUE}
            onConfirm={(val) =>
              setValues((v) => ({
                ...v,
                pickupTime: formatPickerValueToTime(val),
              }))
            }
            title={t.pickupTime}
            confirmText={t.confirm}
            cancelText={t.cancel}
          >
            {(_, actions) => (
              <Form.Item label={t.pickupTime} onClick={actions.open}>
                <span>{values.pickupTime || t.pickupTimePlaceholder}</span>
              </Form.Item>
            )}
          </Picker>

          {/* Route notes */}
          <Form.Item label={t.routeNotes}>
            <TextArea
              value={values.notes}
              onChange={(val) => setValues((v) => ({ ...v, notes: val }))}
              autoSize={{ minRows: 2, maxRows: 4 }}
            />
          </Form.Item>

          {/* Pickup enabled */}
          <Form.Item label={t.pickupEnabled} childElementPosition="right">
            <Switch
              checked={values.isPickupEnabled}
              onChange={(v) =>
                setValues((prev) => ({ ...prev, isPickupEnabled: v }))
              }
            />
          </Form.Item>

          {/* Terminal */}
          <Form.Item label={t.isTerminal} childElementPosition="right">
            <Switch
              checked={values.isTerminal}
              onChange={(v) =>
                setValues((prev) => ({ ...prev, isTerminal: v }))
              }
            />
          </Form.Item>

          <Form.Item>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button block fill="outline" onClick={onClose} disabled={saving}>
                {t.cancel}
              </Button>
              <Button
                block
                color="primary"
                loading={saving}
                onClick={() => onSave(values)}
              >
                {t.save}
              </Button>
            </div>
          </Form.Item>
        </Form>
      </div>
    </Popup>
  );
}
