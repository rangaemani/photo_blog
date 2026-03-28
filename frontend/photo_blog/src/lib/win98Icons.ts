// Win98 icon URLs — sized variants: -0=16px, -1=24px, -3=32px, -4=48px
import camera3Sm from '../assets/windows98-icons/png/camera3-0.png';
import camera3Lg from '../assets/windows98-icons/png/camera3-3.png';
import imageJpegSm from '../assets/windows98-icons/png/image_old_jpeg-0.png';
import imageJpegLg from '../assets/windows98-icons/png/image_old_jpeg-1.png';
import paintFileSm from '../assets/windows98-icons/png/paint_file-0.png';
import paintFileLg from '../assets/windows98-icons/png/paint_file-3.png';
import keyPadlockSm from '../assets/windows98-icons/png/key_padlock-0.png';
import floppySm from '../assets/windows98-icons/png/floppy_drive_3_5-0.png';
import floppyLg from '../assets/windows98-icons/png/floppy_drive_3_5-3.png';
import recycleFullSm from '../assets/windows98-icons/png/recycle_bin_full_2k-5.png';
import recycleFullLg from '../assets/windows98-icons/png/recycle_bin_full_2k-4.png';
import recycleEmptyLg from '../assets/windows98-icons/png/recycle_bin_empty_2k-2.png';
import dirClosedSm from '../assets/windows98-icons/png/directory_closed-0.png';
import dirClosedLg from '../assets/windows98-icons/png/directory_closed-3.png';
import envelopeSm from '../assets/windows98-icons/png/envelope_closed-0.png';
import envelopeLg from '../assets/windows98-icons/png/envelope_closed-1.png';
import globeSm from '../assets/windows98-icons/png/connected_world-1.png';
import globeLg from '../assets/windows98-icons/png/connected_world-0.png';
// UI chrome icons
import warningSm from '../assets/windows98-icons/png/msg_warning-0.png';
import warningMd from '../assets/windows98-icons/png/msg_warning-1.png';
import speakerSm from '../assets/windows98-icons/png/loudspeaker_rays-0.png';
import speakerMutedSm from '../assets/windows98-icons/png/loudspeaker_muted-0.png';
import downloadSm from '../assets/windows98-icons/png/download.png';
import checkSm from '../assets/windows98-icons/png/check-0.png';
import hourglassSm from '../assets/windows98-icons/png/application_hourglass_small-0.png';
import scannerCameraSm from '../assets/windows98-icons/png/scanner_camera-0.png';
import envelopeOpenSm from '../assets/windows98-icons/png/message_envelope_open-0.png';
import tackFolderSm from '../assets/windows98-icons/png/outlook_express_tack_folder-0.png';

export const icons = {
  sm: {
    grid: camera3Sm,
    detail: imageJpegSm,
    static: paintFileSm,
    login: keyPadlockSm,
    upload: floppySm,
    trash: recycleFullSm,
    reports: warningSm,
    folder: dirClosedSm,
    contact: envelopeSm,
    map: globeSm,
    warning: warningSm,
    speaker: speakerSm,
    speakerMuted: speakerMutedSm,
    download: downloadSm,
    check: checkSm,
    hourglass: hourglassSm,
    logo: scannerCameraSm,
    envelopeOpen: envelopeOpenSm,
    pin: tackFolderSm,
  },
  lg: {
    grid: camera3Lg,
    detail: imageJpegLg,
    static: paintFileLg,
    upload: floppyLg,
    recycleEmpty: recycleEmptyLg,
    folder: dirClosedLg,
    contact: envelopeLg,
    map: globeLg,
    recycleFull: recycleFullLg,
    recycleEmpty: recycleEmptyLg,
    warning: warningMd,
  },
};
