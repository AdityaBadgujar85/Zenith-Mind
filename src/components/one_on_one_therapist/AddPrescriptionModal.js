import React, { useState, useMemo, useCallback } from "react";
import { Modal, Button, Form, Spinner } from "react-bootstrap";
import { apiPost } from "./api";
import styles from "./AddPrescriptionModal.module.css";

export default function AddPrescriptionModal({ show, onHide, appointment, onSaved, maxLen = 2000 }) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [touched, setTouched] = useState(false);

  if (!appointment) return null;

  const remaining = useMemo(() => Math.max(0, maxLen - text.length), [text, maxLen]);
  const invalid = touched && !text.trim();

  const handleClose = useCallback(() => {
    if (saving) return;
    onHide?.();
  }, [saving, onHide]);

  async function save() {
    setTouched(true);
    if (!text.trim()) return;
    setSaving(true);
    try {
      const updated = await apiPost(`/api/appointments/${appointment._id}/prescription`, {
        text,
        attachments: [],
      });
      onSaved?.(updated);
      setText("");
      onHide?.();
    } catch (e) {
      alert(e.message || "Failed to save prescription");
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e) {
    const isMetaEnter = (e.key === "Enter" && (e.metaKey || e.ctrlKey));
    if (isMetaEnter && !saving && text.trim()) {
      e.preventDefault();
      save();
    }
  }

  return (
    <Modal
      show={show}
      onHide={handleClose}
      centered
      contentClassName={styles.modal}
      dialogClassName={styles.dialog}
      onKeyDown={onKeyDown}
    >
      <Modal.Header closeButton className={styles.header}>
        <Modal.Title className={styles.title}>Add Prescription</Modal.Title>
      </Modal.Header>

      <Modal.Body className={styles.body}>
        <div className={styles.appointMeta}>
          <span className={styles.pill}>
            {appointment?.patient?.name || "Patient"}
          </span>
          <span className={styles.pill + " " + styles.secondary}>
            {appointment?.date
              ? new Date(appointment.date).toLocaleString()
              : "Scheduled"}
          </span>
        </div>

        <Form.Group className={styles.group}>
          <div className="d-flex align-items-center justify-content-between">
            <Form.Label className={styles.label}>Prescription Notes</Form.Label>
            <small className={styles.counter}>
              {remaining}/{maxLen}
            </small>
          </div>
          <Form.Control
            as="textarea"
            rows={6}
            maxLength={maxLen}
            placeholder="Write the prescription/recommendations here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onBlur={() => setTouched(true)}
            isInvalid={invalid}
            className={styles.textarea}
            disabled={saving}
          />
          <Form.Control.Feedback type="invalid">
            Please enter the prescription text.
          </Form.Control.Feedback>
          <Form.Text className={styles.help}>
            This will be visible to the patient. Press <kbd>Ctrl/⌘ + Enter</kbd> to save.
          </Form.Text>
        </Form.Group>
      </Modal.Body>

      <Modal.Footer className={styles.footer}>
        <Button variant="outline" className={styles.outlineBtn} disabled={saving} onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={save}
          disabled={saving || !text.trim()}
          className={styles.button}
        >
          {saving ? (
            <>
              <Spinner size="sm" animation="border" className="me-2" />
              Saving…
            </>
          ) : (
            "Save Prescription"
          )}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}
