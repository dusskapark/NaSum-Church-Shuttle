import { useCallback, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import {
  Button,
  Form,
  Input,
  Popup,
  Switch,
  TextArea,
  Toast,
} from 'antd-mobile';
import { mutateApi } from '../../lib/queries';

export interface AdminStop {
  route_stop_id: string;
  place_id: string;
  sequence: number;
  pickup_time: string | null;
  route_stop_notes: string | null;
  is_pickup_enabled: boolean;
  google_place_id: string;
  place_name: string;
  place_display_name: string | null;
  place_notes: string | null;
  formatted_address: string | null;
  lat: number;
  lng: number;
  is_terminal: boolean;
}

interface Props {
  stop: AdminStop | null;
  routeId: string;
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  lang: string;
}

interface StopEditDraft {
  stopId: string;
  displayName: string;
  placeNotes: string;
  routeNotes: string;
  pickupTime: string;
  pickupEnabled: boolean;
  sequence: number;
}

const STRINGS = {
  en: {
    editStop: 'Edit Stop',
    displayName: 'Display name',
    displayNameHint: 'Override the Google Maps name shown to users.',
    placeNotes: 'Place notes',
    placeNotesHint: 'Internal notes about this location.',
    routeNotes: 'Route notes',
    routeNotesHint: 'Notes specific to this stop on this route.',
    pickupTime: 'Pickup time',
    pickupTimePlaceholder: 'HH:MM (e.g. 07:30)',
    pickupTimeError: 'Use HH:MM format (e.g. 07:30)',
    pickupEnabled: 'Pickup enabled',
    sequence: 'Stop order',
    save: 'Save',
    cancel: 'Cancel',
    saveSuccess: 'Stop saved.',
    saveError: 'Failed to save stop.',
    stopInfo: 'Stop info',
    googleName: 'Google name',
    address: 'Address',
  },
  ko: {
    editStop: '정류장 수정',
    displayName: '표시 이름',
    displayNameHint: '사용자에게 보여질 Google Maps 이름을 재정의합니다.',
    placeNotes: '장소 메모',
    placeNotesHint: '이 위치에 대한 내부 메모입니다.',
    routeNotes: '노선 메모',
    routeNotesHint: '이 노선에서 이 정류장에 관한 메모입니다.',
    pickupTime: '탑승 시간',
    pickupTimePlaceholder: 'HH:MM (예: 07:30)',
    pickupTimeError: 'HH:MM 형식으로 입력하세요 (예: 07:30)',
    pickupEnabled: '탑승 활성',
    sequence: '정류장 순서',
    save: '저장',
    cancel: '취소',
    saveSuccess: '저장되었습니다.',
    saveError: '저장에 실패했습니다.',
    stopInfo: '정류장 정보',
    googleName: 'Google 이름',
    address: '주소',
  },
};

export default function StopEditSheet({
  stop,
  routeId,
  visible,
  onClose,
  onSaved,
  lang,
}: Props) {
  const t = STRINGS[lang === 'ko' ? 'ko' : 'en'];

  const [draft, setDraft] = useState<StopEditDraft | null>(null);
  const hasStopDraft = !!stop && draft?.stopId === stop.route_stop_id;

  const displayName = hasStopDraft
    ? draft.displayName
    : (stop?.place_display_name ?? '');
  const placeNotes = hasStopDraft ? draft.placeNotes : (stop?.place_notes ?? '');
  const routeNotes = hasStopDraft
    ? draft.routeNotes
    : (stop?.route_stop_notes ?? '');
  const pickupTime = hasStopDraft ? draft.pickupTime : (stop?.pickup_time ?? '');
  const pickupEnabled = hasStopDraft
    ? draft.pickupEnabled
    : (stop?.is_pickup_enabled ?? true);
  const sequence = hasStopDraft ? draft.sequence : (stop?.sequence ?? 1);

  const updateDraft = (
    patch: Partial<Omit<StopEditDraft, 'stopId'>>,
  ) => {
    if (!stop) return;
    setDraft((prev) => {
      const sameDraft = prev?.stopId === stop.route_stop_id;
      return {
        stopId: stop.route_stop_id,
        displayName:
          patch.displayName ??
          (sameDraft ? prev.displayName : (stop.place_display_name ?? '')),
        placeNotes:
          patch.placeNotes ??
          (sameDraft ? prev.placeNotes : (stop.place_notes ?? '')),
        routeNotes:
          patch.routeNotes ??
          (sameDraft ? prev.routeNotes : (stop.route_stop_notes ?? '')),
        pickupTime:
          patch.pickupTime ??
          (sameDraft ? prev.pickupTime : (stop.pickup_time ?? '')),
        pickupEnabled:
          patch.pickupEnabled ??
          (sameDraft ? prev.pickupEnabled : stop.is_pickup_enabled),
        sequence:
          patch.sequence ?? (sameDraft ? prev.sequence : stop.sequence),
      };
    });
  };

  const handleClose = useCallback(() => {
    setDraft(null);
    onClose();
  }, [onClose]);

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      mutateApi<void>(
        `/api/v1/admin/routes/${routeId}/stops/${stop!.route_stop_id}/full`,
        { method: 'PATCH', body },
      ),
    onSuccess: () => {
      Toast.show({ content: t.saveSuccess, icon: 'success' });
      setDraft(null);
      onSaved();
    },
    onError: () => {
      Toast.show({ content: t.saveError, icon: 'fail' });
    },
  });

  const saving = saveMutation.isPending;

  const handleSave = useCallback(() => {
    if (!stop) return;
    const trimmedTime = pickupTime.trim();
    if (trimmedTime && !/^\d{2}:\d{2}$/.test(trimmedTime)) {
      Toast.show({ content: t.pickupTimeError, icon: 'fail' });
      return;
    }
    saveMutation.mutate({
      sequence,
      pickup_time: trimmedTime || null,
      notes: routeNotes.trim() || null,
      is_pickup_enabled: pickupEnabled,
      display_name: displayName.trim() || null,
      place_notes: placeNotes.trim() || null,
    });
  }, [
    stop,
    sequence,
    pickupTime,
    routeNotes,
    pickupEnabled,
    displayName,
    placeNotes,
    t,
    saveMutation,
  ]);

  return (
    <Popup
      visible={visible}
      onMaskClick={handleClose}
      position="bottom"
      bodyStyle={{
        borderRadius: '16px 16px 0 0',
        maxHeight: '85vh',
        overflowY: 'auto',
      }}
    >
      <div style={{ padding: '16px 16px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          {t.editStop}
        </div>

        {stop && (
          <div
            style={{
              padding: '10px 12px',
              background: 'var(--app-color-background-secondary)',
              borderRadius: 10,
              marginBottom: 16,
            }}
          >
            <div style={{ marginBottom: 2 }}>{t.googleName}</div>
            <div style={{ fontWeight: 600 }}>{stop.place_name}</div>
            {stop.formatted_address && (
              <>
                <div style={{ marginTop: 8, marginBottom: 2 }}>{t.address}</div>
                <div style={{ color: 'var(--app-color-subtle-text)' }}>
                  {stop.formatted_address}
                </div>
              </>
            )}
          </div>
        )}

        <Form layout="vertical">
          <Form.Item label={t.displayName} help={t.displayNameHint}>
            <Input
              placeholder={stop?.place_name ?? ''}
              value={displayName}
              onChange={(value) => {
                updateDraft({ displayName: value });
              }}
            />
          </Form.Item>

          <Form.Item label={t.placeNotes}>
            <TextArea
              placeholder={t.placeNotesHint}
              value={placeNotes}
              onChange={(value) => {
                updateDraft({ placeNotes: value });
              }}
              rows={2}
            />
          </Form.Item>

          <Form.Item label={t.routeNotes}>
            <TextArea
              placeholder={t.routeNotesHint}
              value={routeNotes}
              onChange={(value) => {
                updateDraft({ routeNotes: value });
              }}
              rows={2}
            />
          </Form.Item>

          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item
              label={`${t.pickupTime}${pickupEnabled && !pickupTime.trim() ? ' ⚠️' : ''}`}
              style={{ flex: 1 }}
            >
              <Input
                placeholder={t.pickupTimePlaceholder}
                value={pickupTime}
                onChange={(value) => {
                  updateDraft({ pickupTime: value });
                }}
                style={
                  pickupEnabled && !pickupTime.trim()
                    ? ({
                        '--border-color': '#ffe58f',
                        background: '#fffbe6',
                      } as React.CSSProperties)
                    : undefined
                }
              />
            </Form.Item>
            <Form.Item label={t.sequence} style={{ flex: 1 }}>
              <Input
                type="number"
                value={String(sequence)}
                onChange={(value) => {
                  updateDraft({ sequence: parseInt(value, 10) || 1 });
                }}
              />
            </Form.Item>
          </div>

          <Form.Item label={t.pickupEnabled} childElementPosition="right">
            <Switch
              checked={pickupEnabled}
              onChange={(value) => {
                updateDraft({ pickupEnabled: value });
              }}
            />
          </Form.Item>
        </Form>

        <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
          <Button block fill="outline" onClick={handleClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button
            block
            color="primary"
            loading={saving}
            onClick={() => {
              handleSave();
            }}
          >
            {t.save}
          </Button>
        </div>
      </div>
    </Popup>
  );
}
