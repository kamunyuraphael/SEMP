// pages/Devices.tsx
// Device management — list, add, and delete registered devices.
// Each device's category and status drive badge styling consistent
// with the rest of the SEMP design system.

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { deviceService } from '../services/api';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import type { Device, DeviceCategory, AddDevicePayload } from '../types/index';

const CATEGORY_OPTIONS: { value: DeviceCategory; label: string; icon: string }[] = [
  { value: 'kitchen', label: 'Kitchen', icon: 'bi-cup-hot-fill' },
  { value: 'laundry', label: 'Laundry', icon: 'bi-basket3-fill' },
  { value: 'lighting', label: 'Lighting', icon: 'bi-lightbulb-fill' },
  { value: 'entertainment', label: 'Entertainment', icon: 'bi-tv-fill' },
  { value: 'HVAC', label: 'HVAC', icon: 'bi-thermometer-half' },
  { value: 'computing', label: 'Computing', icon: 'bi-laptop-fill' },
];

const CATEGORY_ICONS: Record<DeviceCategory, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((c) => [c.value, c.icon])
) as Record<DeviceCategory, string>;

export default function Devices() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [newWattage, setNewWattage] = useState('');
  const [newCategory, setNewCategory] = useState<DeviceCategory>('kitchen');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<Device | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const fetchDevices = useCallback(async () => {
    try {
      const res = await deviceService.getDevices();
      setDevices(res.data);
      setError(null);
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to load devices.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleAddDevice = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (newName.trim().length === 0 || newWattage.trim().length === 0) {
      setFormError('Device name and rated wattage are required.');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: AddDevicePayload = {
        name: newName.trim(),
        category: newCategory,
        status: 'active',
        location: newLocation.trim() || undefined,
        ratedWattage: Number(newWattage) || undefined,
      };
      await deviceService.addDevice(payload);

      setShowAddModal(false);
      setNewName('');
      setNewLocation('');
      setNewWattage('');
      setNewCategory('kitchen');
      await fetchDevices();
    } catch (err: any) {
      setFormError(
        err?.response?.data?.error ||
        err?.response?.data?.details?.[0]?.message ||
        'Failed to add device.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (device: Device) => {
    const nextStatus = device.status === 'active' ? 'inactive' : 'active';
    setTogglingId(device._id);

    // Optimistic update — flip it locally immediately, roll back on failure
    setDevices((prev) =>
      prev.map((d) => (d._id === device._id ? { ...d, status: nextStatus } : d))
    );

    try {
      await deviceService.updateDeviceStatus(device._id, nextStatus);
    } catch (err: any) {
      setDevices((prev) =>
        prev.map((d) => (d._id === device._id ? { ...d, status: device.status } : d))
      );
      setError(err?.response?.data?.error || `Failed to update ${device.name}.`);
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);

    try {
      await deviceService.deleteDevice(deleteTarget._id);
      setDeleteTarget(null);
      await fetchDevices();
    } catch (err: any) {
      setError(err?.response?.data?.error || 'Failed to delete device.');
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  const totalLifetimeKWh = (device: Device): number =>
    device.consumptionLogs.reduce((sum, log) => sum + log.kWh, 0);

  if (isLoading) {
    return <LoadingSpinner fullPage label="Loading devices..." />;
  }

  return (
    <div>
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h5 className="mb-0" style={{ color: 'var(--text-primary)' }}>
            Your Devices
          </h5>
          <p className="mb-0" style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {devices.length} device{devices.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => setShowAddModal(true)}
        >
          <i className="bi bi-plus-lg me-2" />
          Add Device
        </button>
      </div>

      {error && (
        <div className="alert alert-danger mb-4">
          <i className="bi bi-exclamation-circle-fill me-2" />
          {error}
        </div>
      )}

      {devices.length === 0 ? (
        <div className="chart-card">
          <div className="empty-state">
            <div className="empty-state-icon">
              <i className="bi bi-cpu" />
            </div>
            <div className="empty-state-title">No devices yet</div>
            <p>Add your first device to start tracking its energy consumption.</p>
            <button
              type="button"
              className="btn btn-primary mt-2"
              onClick={() => setShowAddModal(true)}
            >
              <i className="bi bi-plus-lg me-2" />
              Add Device
            </button>
          </div>
        </div>
      ) : (
        <div className="row g-3">
          {devices.map((device) => (
            <div key={device._id} className="col-12 col-sm-6 col-lg-4">
              <div className="stat-card h-100 d-flex flex-column">
                <div className="d-flex justify-content-between align-items-start mb-2">
                  <div className="stat-card-icon orange">
                    <i className={`bi ${CATEGORY_ICONS[device.category]}`} />
                  </div>
                  <span className={`device-status ${device.status}`}>
                    <span className="device-status-dot" />
                    {device.status}
                  </span>
                </div>

                <div className="fw-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
                  {device.name}
                </div>
                {device.location && (
                  <div className="mb-2" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {device.location}
                  </div>
                )}

                <div
                  className="d-flex justify-content-between align-items-center mb-3"
                  style={{ fontSize: '0.8rem' }}
                >
                  <span className="text-capitalize" style={{ color: 'var(--text-muted)' }}>
                    {device.category}
                  </span>
                  {typeof device.ratedWattage === 'number' && (
                    <span className="fw-semibold" style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                      {device.ratedWattage.toLocaleString()} W
                    </span>
                  )}
                </div>

                <div
                  className="d-flex justify-content-between mb-3"
                  style={{ fontSize: '0.8rem' }}
                >
                  <span style={{ color: 'var(--text-muted)' }}>Lifetime usage</span>
                  <span className="fw-semibold" style={{ color: 'var(--text-primary)' }}>
                    {totalLifetimeKWh(device).toFixed(2)} kWh
                  </span>
                </div>

                <div className="mt-auto d-flex gap-2">
                  <button
                    type="button"
                    className={`btn btn-sm flex-grow-1 ${device.status === 'active' ? 'btn-outline-primary' : 'btn-primary'}`}
                    onClick={() => handleToggleStatus(device)}
                    disabled={togglingId === device._id}
                  >
                    {togglingId === device._id ? (
                      <span className="spinner-border spinner-border-sm" />
                    ) : device.status === 'active' ? (
                      'Deactivate'
                    ) : (
                      'Activate'
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm border-0"
                    style={{ color: 'var(--warning)' }}
                    onClick={() => setDeleteTarget(device)}
                    aria-label={`Delete ${device.name}`}
                  >
                    <i className="bi bi-trash-fill" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          role="dialog"
          onClick={() => !isSubmitting && setShowAddModal(false)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            role="document"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Add Device</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSubmitting}
                />
              </div>

              <form onSubmit={handleAddDevice}>
                <div className="modal-body">
                  {formError && (
                    <div className="alert alert-danger py-2 mb-3">
                      <i className="bi bi-exclamation-circle-fill me-2" />
                      {formError}
                    </div>
                  )}

                  <div className="mb-3">
                    <label htmlFor="deviceName" className="form-label">
                      Device Name
                    </label>
                    <input
                      id="deviceName"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Living Room TV"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="deviceLocation" className="form-label">
                      Location
                    </label>
                    <input
                      id="deviceLocation"
                      type="text"
                      className="form-control"
                      placeholder="e.g. Kitchen"
                      value={newLocation}
                      onChange={(e) => setNewLocation(e.target.value)}
                    />
                  </div>

                  <div className="mb-3">
                    <label htmlFor="deviceWattage" className="form-label">
                      Rated Wattage (W)
                    </label>
                    <input
                      id="deviceWattage"
                      type="number"
                      min={0}
                      className="form-control"
                      placeholder="e.g. 1200"
                      value={newWattage}
                      onChange={(e) => setNewWattage(e.target.value)}
                      required
                    />
                  </div>

                  <div className="mb-2">
                    <label className="form-label">Category</label>
                    <div className="row g-2">
                      {CATEGORY_OPTIONS.map((opt) => (
                        <div key={opt.value} className="col-6">
                          <button
                            type="button"
                            className="btn w-100 d-flex align-items-center gap-2 text-start"
                            style={{
                              backgroundColor:
                                newCategory === opt.value
                                  ? 'var(--accent-primary)'
                                  : 'var(--bg-surface)',
                              color:
                                newCategory === opt.value
                                  ? '#ffffff'
                                  : 'var(--text-primary)',
                              border: '1px solid var(--bg-border)',
                            }}
                            onClick={() => setNewCategory(opt.value)}
                          >
                            <i className={`bi ${opt.icon}`} />
                            <span style={{ fontSize: '0.85rem' }}>{opt.label}</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-outline-primary"
                    onClick={() => setShowAddModal(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" />
                        Adding...
                      </>
                    ) : (
                      'Add Device'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div
          className="modal show d-block"
          tabIndex={-1}
          role="dialog"
          onClick={() => !isDeleting && setDeleteTarget(null)}
        >
          <div
            className="modal-dialog modal-dialog-centered"
            role="document"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Delete Device</h5>
                <button
                  type="button"
                  className="btn-close"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                />
              </div>
              <div className="modal-body">
                <p>
                  Are you sure you want to delete <strong>{deleteTarget.name}</strong>?
                  This will not delete its historical telemetry data, but the device
                  will no longer appear in your active list.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-outline-primary"
                  onClick={() => setDeleteTarget(null)}
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn"
                  style={{ backgroundColor: 'var(--warning)', color: '#fff' }}
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" />
                      Deleting...
                    </>
                  ) : (
                    'Delete'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}