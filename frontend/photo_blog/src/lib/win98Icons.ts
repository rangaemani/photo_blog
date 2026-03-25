// Win98 icon URLs — sized variants: -0=16px, -1=24px, -3=32px, -4=48px
import camera3Sm from '../assets/windows98-icons/png/camera3-0.png';
import camera3Lg from '../assets/windows98-icons/png/camera3-3.png';
import imageJpegSm from '../assets/windows98-icons/png/image_old_jpeg-0.png';
import imageJpegLg from '../assets/windows98-icons/png/image_old_jpeg-1.png';
import paintFileSm from '../assets/windows98-icons/png/paint_file-0.png';
import paintFileLg from '../assets/windows98-icons/png/paint_file-3.png';
import keyPadlockSm from '../assets/windows98-icons/png/key_padlock-0.png';
import keyPadlockLg from '../assets/windows98-icons/png/key_padlock-1.png';
import floppySm from '../assets/windows98-icons/png/floppy_drive_3_5-0.png';
import floppyLg from '../assets/windows98-icons/png/floppy_drive_3_5-3.png';
import recycleFullSm from '../assets/windows98-icons/png/recycle_bin_full-0.png';
import recycleFullLg from '../assets/windows98-icons/png/recycle_bin_full-3.png';
import recycleEmptySm from '../assets/windows98-icons/png/recycle_bin_empty-0.png';
import recycleEmptyLg from '../assets/windows98-icons/png/recycle_bin_empty-3.png';
import dirClosedSm from '../assets/windows98-icons/png/directory_closed-0.png';
import dirClosedLg from '../assets/windows98-icons/png/directory_closed-3.png';
import envelopeSm from '../assets/windows98-icons/png/envelope_closed-0.png';
import envelopeLg from '../assets/windows98-icons/png/envelope_closed-1.png';
import globeSm from '../assets/windows98-icons/png/globe_map-0.png';
import globeLg from '../assets/windows98-icons/png/globe_map-3.png';

export const icons = {
  // Small (16px) — title bar
  sm: {
    grid: camera3Sm,
    detail: imageJpegSm,
    static: paintFileSm,
    login: keyPadlockSm,
    upload: floppySm,
    trash: recycleFullSm,
    folder: dirClosedSm,
    contact: envelopeSm,
    map: globeSm,
    recycleFull: recycleFullSm,
    recycleEmpty: recycleEmptySm,
  },
  // Large (32px) — desktop icons
  lg: {
    grid: camera3Lg,
    detail: imageJpegLg,
    static: paintFileLg,
    login: keyPadlockLg,
    upload: floppyLg,
    trash: recycleFullLg,
    folder: dirClosedLg,
    contact: envelopeLg,
    map: globeLg,
    recycleFull: recycleFullLg,
    recycleEmpty: recycleEmptyLg,
  },
};
