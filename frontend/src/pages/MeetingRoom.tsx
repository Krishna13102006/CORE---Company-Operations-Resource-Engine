import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeRaw from 'rehype-raw';
import { api, extractErrorMessage, API_BASE } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useCoreModal } from '../context/ModalContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import {
  Mic,
  MicOff,
  Video as VideoIcon,
  VideoOff,
  MonitorUp,
  MonitorOff,
  PhoneOff,
  MessageSquare,
  Users,
  FileText,
  Copy,
  Check,
  Sparkles,
  Settings,
  Send,
  AlertCircle,
  Radio,
  Plus,
  Lock,
  Unlock,
  Volume2,
  CheckSquare,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  UserX,
  Hourglass,
  Clock,
  Disc,
  Presentation,
  FileUp,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  ExternalLink,
  Download,
  FolderGit2,
  Search,
  X,
  Hand,
  Smile,
  LayoutGrid,
  Pin,
  PinOff,
  FileAudio,
  Code2,
  Palette,
  Kanban,
  Briefcase,
  BookOpen,
  Save,
  Languages,
  Headphones,
  Camera
} from 'lucide-react';
import { CandidateInterviewDossier } from '../components/meetings/CandidateInterviewDossier';
import { MeetingCodeSandbox } from '../components/meetings/MeetingCodeSandbox';
import { MeetingWhiteboard } from '../components/meetings/MeetingWhiteboard';
import { MeetingFrameworkStage } from '../components/meetings/MeetingFrameworkStage';

interface Participant {
  id: string;
  email: string;
  name: string;
  role: string;
  has_joined: boolean;
  is_admitted?: boolean;
}

interface RaisedHand {
  id: string;
  user_id: string;
  email: string;
  name: string;
  raised_at: string;
}

interface FloatingReaction {
  id: string;
  emoji: string;
  senderName: string;
  senderEmail: string;
  xOffset: number;
}

interface AgendaItem {
  id: string;
  text: string;
  is_completed: boolean;
  completed_at: string | null;
}

interface MeetingRoomData {
  id: string;
  title: string;
  description: string;
  host: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
  };
  status: string;
  room_code: string;
  passcode?: string;
  requires_passcode?: boolean;
  is_locked?: boolean;
  waiting_room_enabled?: boolean;
  template_type?: string;
  candidate_summary?: any;
  agenda_items?: AgendaItem[];
  active_presentation?: any;
  recording_url?: string;
  transcript_raw: any[];
  participants: Participant[];
  raised_hands?: RaisedHand[];
  recent_reactions?: any[];
}

interface ChatMessage {
  id: string;
  senderName: string;
  senderEmail: string;
  text: string;
  timestamp: string;
  isSelf: boolean;
}

interface TranscriptItem {
  speaker_name: string;
  speaker_email: string;
  text: string;
  timestamp: string;
}

interface VideoStreamPlayerProps {
  stream: MediaStream | null;
  muted?: boolean;
  isMirror?: boolean;
  className?: string;
}

const VideoStreamPlayer: React.FC<VideoStreamPlayerProps> = ({
  stream,
  muted = true,
  isMirror = false,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (!stream) {
      videoEl.srcObject = null;
      return;
    }

    if (videoEl.srcObject !== stream) {
      videoEl.srcObject = stream;
    }

    // Force DOM properties for Chrome/Safari autoplay compliance
    videoEl.muted = true;
    videoEl.defaultMuted = true;
    videoEl.playsInline = true;

    const playVideo = () => {
      if (videoEl && videoEl.paused) {
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          playPromise.catch((err) => {
            console.warn('Auto-play notice:', err);
          });
        }
      }
    };

    videoEl.onloadedmetadata = () => {
      playVideo();
    };

    playVideo();

    return () => {
      videoEl.onloadedmetadata = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={`${className} ${isMirror ? 'scale-x-[-1]' : ''}`}
    />
  );
};

export const MeetingRoom: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { alert: coreAlert } = useCoreModal();

  // Media streams & tracks
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoDisabled, setIsVideoDisabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const isLocalVideoActive = !isVideoDisabled && !!localStream && localStream.getVideoTracks().length > 0 && localStream.getVideoTracks()[0].enabled;

  // Sidebar & Layout State
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'participants' | 'transcript' | 'agenda' | 'dossier' | 'notes'>('agenda');
  const [stageMode, setStageMode] = useState<'video' | 'code' | 'whiteboard' | 'framework'>('video');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [copiedLink, setCopiedLink] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'speaker'>('grid');
  const [pinnedSpeakerEmail, setPinnedSpeakerEmail] = useState<string | null>(null);
  const [activeSpeakerEmail, setActiveSpeakerEmail] = useState<string | null>(null);

  // Audio Activity Detection & Web Audio State
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioAnimFrameRef = useRef<number | null>(null);
  const [isLocalSpeaking, setIsLocalSpeaking] = useState(false);

  // "You're on Mute" Speech Warning State
  const [isTalkingWhileMuted, setIsTalkingWhileMuted] = useState(false);
  const talkingWhileMutedTimeoutRef = useRef<any>(null);
  const unmutedMicCloneRef = useRef<MediaStreamTrack | null>(null);

  // Push-to-Talk (Hold Spacebar to Unmute) State
  const [isPushToTalkActive, setIsPushToTalkActive] = useState(false);
  const isPushToTalkRef = useRef<boolean>(false);

  // Audio & Video Device Selector Modal State
  const [audioInputDevices, setAudioInputDevices] = useState<{ deviceId: string; label: string; kind: string }[]>([]);
  const [videoInputDevices, setVideoInputDevices] = useState<{ deviceId: string; label: string; kind: string }[]>([]);
  const [audioOutputDevices, setAudioOutputDevices] = useState<{ deviceId: string; label: string; kind: string }[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>(() => localStorage.getItem('core_selected_mic') || '');
  const [selectedCamId, setSelectedCamId] = useState<string>(() => localStorage.getItem('core_selected_cam') || '');
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string>(() => localStorage.getItem('core_selected_speaker') || '');
  const [isDeviceSettingsOpen, setIsDeviceSettingsOpen] = useState(false);

  // Virtual Hand Raising Queue & Floating Reactions State
  const [raisedHands, setRaisedHands] = useState<RaisedHand[]>([]);
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const [isReactionPickerOpen, setIsReactionPickerOpen] = useState(false);
  const knownReactionIdsRef = useRef<Set<string>>(new Set());
  const isMyHandRaised = raisedHands.some((h) => h.email?.toLowerCase() === (user?.email || '').toLowerCase());

  // Meeting & Room State
  const [meeting, setMeeting] = useState<MeetingRoomData | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [newAgendaInput, setNewAgendaInput] = useState('');

  // External Candidate & Guest Check-In State
  const [guestInfo, setGuestInfo] = useState<{ name: string; email: string } | null>(() => {
    try {
      const cached = sessionStorage.getItem(`guest_info_${roomCode}`);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [guestNameInput, setGuestNameInput] = useState('');
  const [guestEmailInput, setGuestEmailInput] = useState('');
  const [guestPasscodeInput, setGuestPasscodeInput] = useState('');
  const [guestFormError, setGuestFormError] = useState<string | null>(null);

  // Speech Recognition Dialect & Debounce State
  const speechLangRef = useRef<string>(localStorage.getItem('core_speech_lang') || 'en-IN');
  const [speechLanguage, setSpeechLanguage] = useState<string>(speechLangRef.current);
  const interimDebounceTimerRef = useRef<any>(null);
  const latestInterimTextRef = useRef<string>('');

  // Meeting Attendee Notebook & Knowledge Base Document Export State
  const [meetingNotes, setMeetingNotes] = useState<string>(() => {
    return localStorage.getItem(`meeting_notes_${roomCode}`) || '';
  });
  const [isSavingNotesToDocs, setIsSavingNotesToDocs] = useState(false);
  const [notesSaveSuccess, setNotesSaveSuccess] = useState<string | null>(null);

  // Document Presentation State
  const [isDocModalOpen, setIsDocModalOpen] = useState(false);
  const [docSearchQuery, setDocSearchQuery] = useState('');
  const [presentationDoc, setPresentationDoc] = useState<any>(null);
  const [presentationZoom, setPresentationZoom] = useState(100);
  const [presentationPage, setPresentationPage] = useState(1);

  // Client-Side Video & Audio Meeting Recorder
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMode, setRecordingMode] = useState<'video' | 'audio' | null>(null);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<any>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  // Waiting Room & Security State
  const [isInWaitingRoom, setIsInWaitingRoom] = useState(false);
  const [isPasscodeModalOpen, setIsPasscodeModalOpen] = useState(false);
  const [enteredPasscode, setEnteredPasscode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [waitingParticipants, setWaitingParticipants] = useState<Participant[]>([]);

  // Live Chat & Transcript
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [liveTranscript, setLiveTranscript] = useState<TranscriptItem[]>([]);
  const [currentSpeechCaption, setCurrentSpeechCaption] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);

  // Meeting duration timer
  const [meetingDuration, setMeetingDuration] = useState(0);

  // Mid-Meeting Invite & Confirmation Dialogs
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmailInput, setInviteEmailInput] = useState('');
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [isEndModalOpen, setIsEndModalOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isEnding, setIsEnding] = useState(false);

  // Media Lifecycle & Stream References
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const isInitializingMediaRef = useRef<boolean>(false);
  const isMeetingActiveRef = useRef<boolean>(true);

  // Speech Recognition Reference
  const recognitionRef = useRef<any>(null);
  const transcriptBufferRef = useRef<TranscriptItem[]>([]);
  const speechRestartTimerRef = useRef<any>(null);
  const isSpeechRunningRef = useRef<boolean>(false);

  // 1. Join Meeting API on mount
  const handleJoinMeeting = async (passcodeToSubmit = '', gName?: string, gEmail?: string) => {
    try {
      setJoinError(null);
      const activeGuest = gName && gEmail ? { name: gName, email: gEmail } : guestInfo;
      const payload: any = {
        passcode: passcodeToSubmit,
      };
      if (!user && activeGuest) {
        payload.guest_name = activeGuest.name;
        payload.guest_email = activeGuest.email;
      }

      const res = await api.post(`/meetings/room/${roomCode}/join/`, payload);

      if (res.status === 'waiting_room') {
        setIsInWaitingRoom(true);
        setIsPasscodeModalOpen(false);
        return;
      }

      setIsInWaitingRoom(false);
      setMeeting(res.meeting);
      setAgendaItems(res.meeting.agenda_items || []);
      setIsLocked(!!res.meeting.is_locked);
      setParticipants(res.meeting.participants || []);
      setLiveTranscript(res.meeting.transcript_raw || []);
      if (res.meeting.raised_hands) {
        setRaisedHands(res.meeting.raised_hands);
      }
      if (res.meeting.recent_reactions) {
        handleSyncReactions(res.meeting.recent_reactions);
      }
      setIsPasscodeModalOpen(false);

      // Start duration counter
      const interval = setInterval(() => {
        setMeetingDuration((prev) => prev + 1);
      }, 1000);

      // Start Local Media Stream (only if not already running or initializing)
      if (!localStreamRef.current && !localStream) {
        initUserMedia();
      }

      // Start Real-Time Speech Recognition
      initSpeechRecognition();

      return () => clearInterval(interval);
    } catch (err: any) {
      if (err.status === 403 || err.message?.toLowerCase().includes('passcode') || err.data?.requires_passcode) {
        setIsPasscodeModalOpen(true);
      } else {
        setJoinError(extractErrorMessage(err));
      }
    }
  };

  useEffect(() => {
    isMeetingActiveRef.current = true;
    initUserMedia();
    if (roomCode) {
      if (user || guestInfo) {
        handleJoinMeeting('', guestInfo?.name, guestInfo?.email);
      } else {
        // Pre-fetch public room preview for the lobby
        api
          .get(`/meetings/room/${roomCode}/`)
          .then((data) => {
            if (data) setMeeting(data);
          })
          .catch(() => {});
      }
    }

    const handleBeforeUnload = () => {
      stopAllMediaTracks();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      stopAllMediaTracks();
    };
  }, [roomCode]);

  // Polling for Waiting Room attendees to check if admitted
  useEffect(() => {
    if (!isInWaitingRoom || !roomCode) return;
    const pollInterval = setInterval(() => {
      handleJoinMeeting(enteredPasscode || guestPasscodeInput, guestInfo?.name, guestInfo?.email);
    }, 2500);
    return () => clearInterval(pollInterval);
  }, [isInWaitingRoom, roomCode, enteredPasscode, guestPasscodeInput, guestInfo]);

  const isHost = meeting?.host?.id === user?.id;

  // Host: Poll waiting participants list
  const { data: waitingList } = useQuery<Participant[]>({
    queryKey: ['waiting-room-participants', roomCode],
    queryFn: () => api.get(`/meetings/room/${roomCode}/waiting/`),
    refetchInterval: isHost ? 3500 : false,
    enabled: isHost && !!meeting,
  });

  useEffect(() => {
    if (waitingList) {
      setWaitingParticipants(waitingList);
    }
  }, [waitingList]);

  // Host: Admit or Decline participant
  const handleAdmitParticipant = async (participantId: string, action: 'admit' | 'decline') => {
    try {
      await api.post(`/meetings/room/${roomCode}/admit/`, {
        participant_id: participantId,
        action,
      });
      setWaitingParticipants((prev) => prev.filter((p) => p.id !== participantId));
      const res = await api.get(`/meetings/room/${roomCode}/`);
      if (res.meeting) {
        setParticipants(res.meeting.participants || []);
      }
    } catch (err) {
      coreAlert({
        title: 'Admission Failed',
        description: extractErrorMessage(err) || 'Failed to admit participant into the meeting.',
        variant: 'destructive',
      });
    }
  };

  // Host: Toggle Room Lock
  const handleToggleLock = async () => {
    try {
      const res = await api.post(`/meetings/room/${roomCode}/lock/`);
      setIsLocked(res.is_locked);
    } catch (err) {
      coreAlert({
        title: 'Lock Failed',
        description: extractErrorMessage(err) || 'Failed to update meeting room lock state.',
        variant: 'destructive',
      });
    }
  };

  // Agenda Action: Toggle Completed
  const handleToggleAgendaItem = async (itemId: string, currentCompleted: boolean) => {
    const newStatus = !currentCompleted;
    setAgendaItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              is_completed: newStatus,
              completed_at: newStatus ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : null,
            }
          : item
      )
    );
    try {
      const res = await api.post(`/meetings/room/${roomCode}/agenda/`, {
        item_id: itemId,
        is_completed: newStatus,
      });
      if (res.agenda_items) {
        setAgendaItems(res.agenda_items);
      }
    } catch (err) {
      console.error('Failed to update agenda item:', err);
    }
  };

  // Agenda Action: Add New Topic
  const handleAddAgendaItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAgendaInput.trim()) return;
    const text = newAgendaInput.trim();
    setNewAgendaInput('');
    try {
      const res = await api.post(`/meetings/room/${roomCode}/agenda/`, {
        new_item_text: text,
      });
      if (res.agenda_items) {
        setAgendaItems(res.agenda_items);
      }
    } catch (err) {
      console.error('Failed to add agenda item:', err);
    }
  };

  // Periodic polling for room data (including synchronized active_presentation & agenda)
  const { data: latestRoomData } = useQuery({
    queryKey: ['room-latest-state', roomCode],
    queryFn: () => api.get(`/meetings/room/${roomCode}/`),
    refetchInterval: 3000,
    enabled: !!meeting && !isInWaitingRoom,
  });

  useEffect(() => {
    if (latestRoomData?.meeting) {
      if (latestRoomData.meeting.active_presentation && Object.keys(latestRoomData.meeting.active_presentation).length > 0) {
        setPresentationDoc(latestRoomData.meeting.active_presentation);
        if (latestRoomData.meeting.active_presentation.page) {
          setPresentationPage(latestRoomData.meeting.active_presentation.page);
        }
      } else {
        setPresentationDoc(null);
      }
      if (latestRoomData.meeting.agenda_items) {
        setAgendaItems(latestRoomData.meeting.agenda_items);
      }
      if (latestRoomData.meeting.is_locked !== undefined) {
        setIsLocked(latestRoomData.meeting.is_locked);
      }
      if (latestRoomData.meeting.participants) {
        setParticipants(latestRoomData.meeting.participants);
      }
      if (latestRoomData.meeting.raised_hands) {
        setRaisedHands(latestRoomData.meeting.raised_hands);
      }
      if (latestRoomData.meeting.recent_reactions) {
        handleSyncReactions(latestRoomData.meeting.recent_reactions);
      }
    }
  }, [latestRoomData]);

  // Fetch Knowledge Base Documents for in-room presentation selection
  const { data: kbDocsData, isLoading: isKbDocsLoading } = useQuery<any>({
    queryKey: ['kb-documents-for-meeting'],
    queryFn: () => api.get('/knowledge/documents/'),
    enabled: isDocModalOpen,
  });
  const kbDocuments = Array.isArray(kbDocsData?.results) ? kbDocsData.results : Array.isArray(kbDocsData) ? kbDocsData : [];

  // Start Document Presentation
  const handleStartPresentingDoc = async (doc: any) => {
    const payload = {
      action: 'start',
      doc_id: doc.id || null,
      title: doc.title || 'Document Presentation',
      url: doc.file_path || doc.url || '',
      content: doc.article_content || doc.content || '',
      file_type: doc.file_type || (doc.url?.endsWith('.pdf') ? 'pdf' : 'doc'),
      page: 1,
    };
    setPresentationDoc(payload);
    setPresentationPage(1);
    setIsDocModalOpen(false);

    try {
      await api.post(`/meetings/room/${roomCode}/presentation/`, payload);
    } catch (err) {
      console.error('Failed to broadcast presentation:', err);
    }
  };

  // Upload Local PDF / Text to present
  const handleUploadAndPresentLocalDoc = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      const blobUrl = URL.createObjectURL(file);
      handleStartPresentingDoc({
        title: file.name,
        url: blobUrl,
        file_type: 'pdf',
      });
    } else {
      const reader = new FileReader();
      reader.onload = (event) => {
        const textContent = event.target?.result as string;
        handleStartPresentingDoc({
          title: file.name,
          content: textContent,
          file_type: 'txt',
        });
      };
      reader.readAsText(file);
    }
  };

  // Stop Document Presentation
  const handleStopPresenting = async () => {
    setPresentationDoc(null);
    try {
      await api.post(`/meetings/room/${roomCode}/presentation/`, { action: 'stop' });
    } catch (err) {
      console.error('Failed to stop presentation:', err);
    }
  };

  // Update Page / Slide
  const handleUpdatePresentationPage = async (newPage: number) => {
    if (newPage < 1) return;
    setPresentationPage(newPage);
    try {
      await api.post(`/meetings/room/${roomCode}/presentation/`, {
        action: 'update_page',
        page: newPage,
      });
    } catch (err) {
      console.error('Failed to sync page:', err);
    }
  };

  // Client-Side Video & Audio Meeting Recorder
  const handleStartRecording = async (mode: 'video' | 'audio') => {
    setIsRecordModalOpen(false);
    try {
      let combinedStream: MediaStream;
      let mimeType = '';

      if (mode === 'video') {
        const displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: { displaySurface: 'monitor' } as any,
          audio: true,
        });

        // Blend local mic audio track if available
        const tracks = [...displayStream.getTracks()];
        if (localStream && localStream.getAudioTracks().length > 0) {
          tracks.push(localStream.getAudioTracks()[0]);
        }
        combinedStream = new MediaStream(tracks);

        mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')
          ? 'video/webm;codecs=vp8,opus'
          : MediaRecorder.isTypeSupported('video/mp4')
          ? 'video/mp4'
          : 'video/webm';

        displayStream.getVideoTracks()[0].onended = () => {
          handleStopRecording();
        };
      } else {
        // Audio-Only Recording: Get mic audio stream without ANY screen sharing prompt!
        if (localStream && localStream.getAudioTracks().length > 0) {
          combinedStream = new MediaStream([localStream.getAudioTracks()[0]]);
        } else {
          combinedStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        }

        mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : MediaRecorder.isTypeSupported('audio/ogg')
          ? 'audio/ogg'
          : 'audio/webm';
      }

      recordingStreamRef.current = combinedStream;
      recordedChunksRef.current = [];
      setRecordingMode(mode);

      const recorder = new MediaRecorder(combinedStream, { mimeType });
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        clearInterval(recordingTimerRef.current);
        setIsRecording(false);
        setRecordingSeconds(0);
        const finalMode = mode;
        setRecordingMode(null);

        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        if (blob.size > 0) {
          const ext = mimeType.includes('mp4') ? (finalMode === 'audio' ? 'm4a' : 'mp4') : 'webm';
          const fileName = `meeting_${roomCode}_${finalMode}_${new Date().toISOString().slice(0, 10)}.${ext}`;

          // Trigger browser download
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          URL.revokeObjectURL(url);
          document.body.removeChild(a);

          // Upload recording to backend meeting record
          try {
            const formData = new FormData();
            formData.append('file', blob, fileName);
            await api.post(`/meetings/room/${roomCode}/recording/`, formData);
          } catch (e) {
            console.warn('Backend recording upload error:', e);
          }
        }

        if (recordingStreamRef.current) {
          if (finalMode === 'video') {
            recordingStreamRef.current.getTracks().forEach((t) => t.stop());
          }
          recordingStreamRef.current = null;
        }
      };

      recorder.start(1000);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingSeconds(0);

      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((prev) => prev + 1);
      }, 1000);
    } catch (err) {
      console.warn('Meeting recording error:', err);
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
  };

  // Periodic polling for participants & remote transcripts
  const { data: latestTranscript } = useQuery({
    queryKey: ['room-transcript', roomCode],
    queryFn: () => api.get(`/meetings/room/${roomCode}/transcript/`),
    refetchInterval: 5000,
    enabled: !!meeting && !isInWaitingRoom,
  });

  useEffect(() => {
    if (latestTranscript?.transcript_raw) {
      setLiveTranscript(latestTranscript.transcript_raw);
    }
  }, [latestTranscript]);

  // Web Audio API Audio Activity Analyser
  const startAudioAnalyser = (stream: MediaStream) => {
    try {
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) return;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;

      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioContextClass();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.4;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      const checkVolume = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const avg = sum / dataArray.length;
        const speaking = avg > 14 && !isAudioMuted;

        // "You're on Mute" Speech Warning detection
        if (avg > 16 && isAudioMuted) {
          setIsTalkingWhileMuted(true);
          if (talkingWhileMutedTimeoutRef.current) {
            clearTimeout(talkingWhileMutedTimeoutRef.current);
          }
          talkingWhileMutedTimeoutRef.current = setTimeout(() => {
            setIsTalkingWhileMuted(false);
          }, 2400);
        }

        setIsLocalSpeaking((prev) => {
          if (prev !== speaking) {
            if (speaking) {
              setActiveSpeakerEmail(user?.email || null);
            }
            return speaking;
          }
          return prev;
        });

        audioAnimFrameRef.current = requestAnimationFrame(checkVolume);
      };

      checkVolume();
    } catch (err) {
      console.warn('Audio analyser error:', err);
    }
  };

  function stopAudioAnalyser() {
    if (audioAnimFrameRef.current) {
      cancelAnimationFrame(audioAnimFrameRef.current);
      audioAnimFrameRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }
    setIsLocalSpeaking(false);
  }

  function stopAllMediaTracks() {
    isMeetingActiveRef.current = false;

    // 1. Permanently stop speech recognition and clear restart timers
    if (speechRestartTimerRef.current) {
      clearTimeout(speechRestartTimerRef.current);
      speechRestartTimerRef.current = null;
    }
    if (interimDebounceTimerRef.current) {
      clearTimeout(interimDebounceTimerRef.current);
      interimDebounceTimerRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.onresult = null;
        recognitionRef.current.onstart = null;
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    isSpeechRunningRef.current = false;
    setIsTranscribing(false);

    // 2. Stop audio activity analyser and close Web Audio context
    stopAudioAnalyser();

    if (unmutedMicCloneRef.current) {
      try { unmutedMicCloneRef.current.stop(); } catch {}
      unmutedMicCloneRef.current = null;
    }
    if (talkingWhileMutedTimeoutRef.current) {
      clearTimeout(talkingWhileMutedTimeoutRef.current);
      talkingWhileMutedTimeoutRef.current = null;
    }
    setIsTalkingWhileMuted(false);
    setIsPushToTalkActive(false);

    // 3. Stop local webcam and mic
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {}
      });
      localStreamRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {}
      });
      setLocalStream(null);
    }

    // 4. Stop screen stream
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {}
      });
      screenStreamRef.current = null;
    }
    if (screenStream) {
      screenStream.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {}
      });
      setScreenStream(null);
    }

    // 5. Stop recording stream
    if (recordingStreamRef.current) {
      recordingStreamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
          track.enabled = false;
        } catch {}
      });
      recordingStreamRef.current = null;
    }

    // 6. Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
  }

  // Virtual Hand Raising Queue Actions
  const handleToggleHand = async (action: 'toggle' | 'lower' | 'raise' = 'toggle', targetEmail?: string) => {
    try {
      const res = await api.post(`/meetings/room/${roomCode}/hand/`, {
        action,
        target_email: targetEmail,
      });
      if (res.raised_hands) {
        setRaisedHands(res.raised_hands);
      }
    } catch (err) {
      console.warn('Failed to toggle hand raise:', err);
    }
  };

  const handleLowerAllHands = async () => {
    try {
      const res = await api.post(`/meetings/room/${roomCode}/hand/`, {
        action: 'lower_all',
      });
      if (res.raised_hands) {
        setRaisedHands(res.raised_hands);
      }
    } catch (err) {
      console.warn('Failed to lower all hands:', err);
    }
  };

  // Floating Emoji Reactions Actions
  const spawnFloatingEmoji = (emoji: string, senderName: string, senderEmail: string, id?: string) => {
    const reactionId = id || Math.random().toString(36).substring(2, 9);
    if (knownReactionIdsRef.current.has(reactionId)) return;
    knownReactionIdsRef.current.add(reactionId);

    const xOffset = 20 + Math.random() * 60;
    const newReaction: FloatingReaction = {
      id: reactionId,
      emoji,
      senderName,
      senderEmail,
      xOffset,
    };

    setFloatingReactions((prev) => [...prev, newReaction]);

    setTimeout(() => {
      setFloatingReactions((prev) => prev.filter((r) => r.id !== reactionId));
    }, 3200);
  };

  const handleSyncReactions = (reactions: any[]) => {
    if (!Array.isArray(reactions)) return;
    reactions.forEach((r) => {
      if (r.id && !knownReactionIdsRef.current.has(r.id)) {
        spawnFloatingEmoji(r.emoji, r.sender_name || 'Participant', r.sender_email || '', r.id);
      }
    });
  };

  const handleSendReaction = async (emoji: string) => {
    setIsReactionPickerOpen(false);
    const myName = user?.first_name ? `${user.first_name} ${user.last_name}` : user?.email || 'You';
    spawnFloatingEmoji(emoji, myName, user?.email || '');

    try {
      const res = await api.post(`/meetings/room/${roomCode}/reaction/`, { emoji });
      if (res.recent_reactions) {
        handleSyncReactions(res.recent_reactions);
      }
    } catch (err) {
      console.warn('Failed to send reaction:', err);
    }
  };

  // 2. Initialize Camera & Mic with layered fallbacks
  const initUserMedia = async () => {
    if (!isMeetingActiveRef.current) return;
    if (isInitializingMediaRef.current) return;
    if (localStreamRef.current && localStreamRef.current.getTracks().some((t) => t.readyState === 'live')) {
      return;
    }

    isInitializingMediaRef.current = true;
    setMediaError(null);

    // Stop any stale tracks before starting fresh
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      localStreamRef.current = null;
    }
    if (localStream) {
      localStream.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      setLocalStream(null);
    }

    let stream: MediaStream | null = null;
    try {
      const audioConstraints: any = selectedMicId
        ? { deviceId: { exact: selectedMicId } }
        : true;
      const videoConstraints: any = selectedCamId
        ? { deviceId: { exact: selectedCamId }, width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }
        : { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' };

      // Layer 1: Ideal HD video + audio with selected devices
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: videoConstraints,
          audio: audioConstraints,
        });
      } catch (e1) {
        console.warn('Selected device / Ideal HD getUserMedia failed, trying generic video+audio:', e1);
        // Layer 2: Generic video + audio (no resolution constraints)
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
        } catch (e2) {
          console.warn('Generic video+audio failed, trying video only:', e2);
          // Layer 3: Video only (in case mic has exclusive lock or permission block)
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: true,
            });
          } catch (e3) {
            console.warn('Video only failed, trying audio only:', e3);
            // Layer 4: Audio only (webcam hardware in use or blocked)
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
              });
              setIsVideoDisabled(true);
              setMediaError('Camera not accessible or permission denied. Microphone is active.');
            } catch (e4: any) {
              console.error('All media acquisition failed:', e4);
              setIsVideoDisabled(true);
              setIsAudioMuted(true);
              setMediaError(
                e4.name === 'NotAllowedError'
                  ? 'Camera & Microphone access blocked. Please allow permissions in your browser address bar.'
                  : e4.name === 'NotReadableError'
                  ? 'Camera or Microphone is currently in use by another application.'
                  : 'Could not access camera or microphone. Check device permissions.'
              );
            }
          }
        }
      }
    } finally {
      isInitializingMediaRef.current = false;
    }

    // If meeting was ended/closed while userMedia dialog was open in browser
    if (!isMeetingActiveRef.current && stream) {
      stream.getTracks().forEach((t) => {
        try { t.stop(); } catch {}
      });
      return;
    }

    if (stream) {
      localStreamRef.current = stream;
      setLocalStream(stream);

      // Create an unmuted clone track exclusively for local speaking & talking-while-muted detection
      if (unmutedMicCloneRef.current) {
        try { unmutedMicCloneRef.current.stop(); } catch {}
      }
      const rawAudioTrack = stream.getAudioTracks()[0];
      if (rawAudioTrack) {
        const clone = rawAudioTrack.clone();
        clone.enabled = true;
        unmutedMicCloneRef.current = clone;
        startAudioAnalyser(new MediaStream([clone]));
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (!videoTrack) {
        setIsVideoDisabled(true);
      } else {
        videoTrack.enabled = !isVideoDisabled;
      }

      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        setIsAudioMuted(true);
      } else {
        audioTrack.enabled = !isAudioMuted;
      }

      refreshMediaDevices();
    }
  };

  // Hardware Device Discovery & Switching
  const refreshMediaDevices = async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter((d) => d.kind === 'audioinput').map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Microphone ${i + 1}`,
        kind: d.kind,
      }));
      const cams = devices.filter((d) => d.kind === 'videoinput').map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Camera ${i + 1}`,
        kind: d.kind,
      }));
      const speakers = devices.filter((d) => d.kind === 'audiooutput').map((d, i) => ({
        deviceId: d.deviceId,
        label: d.label || `Speaker / Headphones ${i + 1}`,
        kind: d.kind,
      }));

      setAudioInputDevices(mics);
      setVideoInputDevices(cams);
      setAudioOutputDevices(speakers);

      if (!selectedMicId && mics.length > 0) setSelectedMicId(mics[0].deviceId);
      if (!selectedCamId && cams.length > 0) setSelectedCamId(cams[0].deviceId);
      if (!selectedSpeakerId && speakers.length > 0) setSelectedSpeakerId(speakers[0].deviceId);
    } catch (err) {
      console.warn('Failed to enumerate media devices:', err);
    }
  };

  const switchDevice = async (kind: 'audio' | 'video' | 'speaker', newDeviceId: string) => {
    if (kind === 'audio') {
      setSelectedMicId(newDeviceId);
      localStorage.setItem('core_selected_mic', newDeviceId);
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          audio: { deviceId: { exact: newDeviceId } },
        });
        const newAudioTrack = newStream.getAudioTracks()[0];
        if (newAudioTrack && localStreamRef.current) {
          const oldAudioTrack = localStreamRef.current.getAudioTracks()[0];
          if (oldAudioTrack) {
            oldAudioTrack.stop();
            localStreamRef.current.removeTrack(oldAudioTrack);
          }
          newAudioTrack.enabled = !isAudioMuted;
          localStreamRef.current.addTrack(newAudioTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));

          if (unmutedMicCloneRef.current) {
            try { unmutedMicCloneRef.current.stop(); } catch {}
          }
          const clone = newAudioTrack.clone();
          clone.enabled = true;
          unmutedMicCloneRef.current = clone;
          startAudioAnalyser(new MediaStream([clone]));
        }
      } catch (e) {
        console.warn('Failed to switch audio input device:', e);
      }
    } else if (kind === 'video') {
      setSelectedCamId(newDeviceId);
      localStorage.setItem('core_selected_cam', newDeviceId);
      try {
        const newStream = await navigator.mediaDevices.getUserMedia({
          video: {
            deviceId: { exact: newDeviceId },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (newVideoTrack && localStreamRef.current) {
          const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (oldVideoTrack) {
            oldVideoTrack.stop();
            localStreamRef.current.removeTrack(oldVideoTrack);
          }
          newVideoTrack.enabled = !isVideoDisabled;
          localStreamRef.current.addTrack(newVideoTrack);
          setLocalStream(new MediaStream(localStreamRef.current.getTracks()));
        }
      } catch (e) {
        console.warn('Failed to switch video camera device:', e);
      }
    } else if (kind === 'speaker') {
      setSelectedSpeakerId(newDeviceId);
      localStorage.setItem('core_selected_speaker', newDeviceId);
      const audioElements = document.querySelectorAll('audio, video');
      audioElements.forEach((el: any) => {
        if (typeof el.setSinkId === 'function') {
          el.setSinkId(newDeviceId).catch(() => {});
        }
      });
    }
  };

  // Push-to-Talk Keyboard Listener (Hold Spacebar to Unmute)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const target = e.target as HTMLElement;
      const tag = target?.tagName?.toLowerCase();
      if (
        target?.isContentEditable ||
        tag === 'input' ||
        tag === 'textarea' ||
        tag === 'select' ||
        target?.closest('.monaco-editor')
      ) {
        return;
      }

      if (isAudioMuted) {
        e.preventDefault();
        isPushToTalkRef.current = true;
        setIsPushToTalkActive(true);
        const stream = localStreamRef.current || localStream;
        if (stream && stream.getAudioTracks().length > 0) {
          stream.getAudioTracks()[0].enabled = true;
          setIsAudioMuted(false);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      if (isPushToTalkRef.current) {
        e.preventDefault();
        isPushToTalkRef.current = false;
        setIsPushToTalkActive(false);
        const stream = localStreamRef.current || localStream;
        if (stream && stream.getAudioTracks().length > 0) {
          stream.getAudioTracks()[0].enabled = false;
          setIsAudioMuted(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isAudioMuted, localStream]);

  // Fast Speech Commit Helper
  const commitTranscriptSegment = (text: string) => {
    if (interimDebounceTimerRef.current) {
      clearTimeout(interimDebounceTimerRef.current);
      interimDebounceTimerRef.current = null;
    }
    const cleanText = text.trim();
    if (!cleanText) return;

    const myName = user?.first_name
      ? `${user.first_name} ${user.last_name}`
      : user?.email || guestInfo?.name || 'Speaker';
    const myEmail = user?.email || guestInfo?.email || 'guest@candidate.core';

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;

    const entry: TranscriptItem = {
      speaker_name: myName,
      speaker_email: myEmail,
      text: cleanText,
      timestamp: timeStr,
    };

    setLiveTranscript((prev) => [...prev, entry]);
    transcriptBufferRef.current.push(entry);
    setActiveSpeakerEmail(myEmail);
    flushTranscriptBuffer();
  };

  // 3. Web Speech Recognition for Real-Time Transcription HUD with Sub-Second Latency
  const initSpeechRecognition = (langOverride?: string) => {
    if (!isMeetingActiveRef.current) return;

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn('Web Speech API is not supported in this browser.');
      return;
    }

    try {
      if (recognitionRef.current) {
        recognitionRef.current.onend = null;
        recognitionRef.current.abort();
      }
    } catch {}

    const targetLang = langOverride || speechLangRef.current || 'en-IN';
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = targetLang;

    recognition.onstart = () => {
      isSpeechRunningRef.current = true;
      setIsTranscribing(true);
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptText = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          const finalClean = transcriptText.trim();
          if (finalClean) {
            commitTranscriptSegment(finalClean);
            latestInterimTextRef.current = '';
            setCurrentSpeechCaption('');
          }
        } else {
          interim += transcriptText;
        }
      }

      const cleanInterim = interim.trim();
      setCurrentSpeechCaption(cleanInterim);
      latestInterimTextRef.current = cleanInterim;

      if (cleanInterim) {
        const myEmail = user?.email || guestInfo?.email || null;
        setActiveSpeakerEmail(myEmail);

        // Fast Debounced Commit: If speaker pauses for 850ms, commit interim words immediately
        if (interimDebounceTimerRef.current) {
          clearTimeout(interimDebounceTimerRef.current);
        }
        interimDebounceTimerRef.current = setTimeout(() => {
          if (latestInterimTextRef.current && latestInterimTextRef.current.length > 2) {
            commitTranscriptSegment(latestInterimTextRef.current);
            latestInterimTextRef.current = '';
            setCurrentSpeechCaption('');
          }
        }, 850);
      }
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech' || event.error === 'aborted') {
        return; // Harmless pause in speech or intentional abort
      }
      console.warn('Speech recognition notice:', event.error);
    };

    recognition.onend = () => {
      isSpeechRunningRef.current = false;
      if (speechRestartTimerRef.current) {
        clearTimeout(speechRestartTimerRef.current);
        speechRestartTimerRef.current = null;
      }
      // ONLY restart speech recognition continuously during call if meeting is active and mic unmuted
      if (!isMeetingActiveRef.current) return;

      speechRestartTimerRef.current = setTimeout(() => {
        if (isMeetingActiveRef.current && !isAudioMuted && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch {}
        }
      }, 400);
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
    } catch (e) {
      console.warn('Speech recognition start failed:', e);
    }
  };

  // Switch Speech Dialect / Accent
  const handleSelectSpeechLanguage = (newLang: string) => {
    speechLangRef.current = newLang;
    setSpeechLanguage(newLang);
    localStorage.setItem('core_speech_lang', newLang);
    initSpeechRecognition(newLang);
  };

  // Attendee Notebook Handlers
  const handleNotesChange = (text: string) => {
    setMeetingNotes(text);
    localStorage.setItem(`meeting_notes_${roomCode}`, text);
  };

  const handleInsertTemplate = (snippet: string) => {
    const updated = (meetingNotes ? meetingNotes.trim() + '\n\n' : '') + snippet;
    handleNotesChange(updated);
  };

  const handleDownloadNotes = () => {
    if (!meetingNotes.trim()) {
      coreAlert({ title: 'Empty Notes', description: 'Write some notes before downloading.' });
      return;
    }
    const cleanTitle = (meeting?.title || 'meeting').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const blob = new Blob([meetingNotes], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cleanTitle}_notes_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    URL.revokeObjectURL(url);
    document.body.removeChild(a);
  };

  const handleSaveNotesToDocs = async () => {
    if (!meetingNotes.trim()) {
      coreAlert({ title: 'Empty Notes', description: 'Write some notes before saving to Organization Documents.' });
      return;
    }
    if (!user) {
      coreAlert({
        title: 'Employee Feature',
        description: 'Saving directly to company documents is reserved for employee team members. Please click "Download" to save your notes locally.'
      });
      return;
    }

    try {
      setIsSavingNotesToDocs(true);
      setNotesSaveSuccess(null);
      const title = `Meeting Notes: ${meeting?.title || 'Team Sync'} (${new Date().toLocaleDateString()})`;
      await api.post('/knowledge/wiki/article/', {
        title,
        content: meetingNotes,
        category: 'Meeting Notes',
        allowed_roles: 'admin,hr,manager,employee',
      });
      setNotesSaveSuccess('Saved to Organization Documents & indexed in Knowledge Base!');
      setTimeout(() => setNotesSaveSuccess(null), 4000);
    } catch (err) {
      coreAlert({
        title: 'Save Failed',
        description: extractErrorMessage(err) || 'Failed to save notes to Organization Documents.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingNotesToDocs(false);
    }
  };

  // Guest / Candidate Join Form Submission
  const handleGuestJoinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestNameInput.trim()) {
      setGuestFormError('Please enter your full name.');
      return;
    }
    if (!guestEmailInput.trim() || !guestEmailInput.includes('@')) {
      setGuestFormError('Please enter a valid email address.');
      return;
    }
    setGuestFormError(null);
    const info = {
      name: guestNameInput.trim(),
      email: guestEmailInput.trim().toLowerCase(),
    };
    setGuestInfo(info);
    sessionStorage.setItem(`guest_info_${roomCode}`, JSON.stringify(info));
    handleJoinMeeting(guestPasscodeInput.trim(), info.name, info.email);
  };

  const flushTranscriptBuffer = async () => {
    if (transcriptBufferRef.current.length === 0 || !roomCode) return;
    const entriesToSend = [...transcriptBufferRef.current];
    transcriptBufferRef.current = [];

    try {
      await api.post(`/meetings/room/${roomCode}/transcript/`, {
        entries: entriesToSend,
      });
    } catch (err) {
      console.error('Failed to sync transcript batch:', err);
    }
  };

  // Toggle Audio Mute
  const toggleAudio = async () => {
    const stream = localStreamRef.current || localStream;
    if (!stream || stream.getAudioTracks().length === 0) {
      await initUserMedia();
      return;
    }
    const audioTrack = stream.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const nowMuted = !audioTrack.enabled;
      setIsAudioMuted(nowMuted);
      if (!nowMuted) {
        startAudioAnalyser(stream);
        if (recognitionRef.current && !isSpeechRunningRef.current && isMeetingActiveRef.current) {
          try {
            recognitionRef.current.start();
            isSpeechRunningRef.current = true;
          } catch {}
        }
      } else {
        setIsLocalSpeaking(false);
        if (speechRestartTimerRef.current) {
          clearTimeout(speechRestartTimerRef.current);
          speechRestartTimerRef.current = null;
        }
        if (recognitionRef.current) {
          try {
            recognitionRef.current.stop();
            isSpeechRunningRef.current = false;
          } catch {}
        }
      }
    }
  };

  // Toggle Video Off / On
  const toggleVideo = async () => {
    const stream = localStreamRef.current || localStream;
    if (!stream || stream.getVideoTracks().length === 0) {
      await initUserMedia();
      return;
    }
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoDisabled(!videoTrack.enabled);
    }
  };

  // Toggle Screen Share with System/Tab Audio Sharing & Auto Presenter Spotlight
  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true, // Enables tab/system audio sharing
        });
        screenStreamRef.current = stream;
        setScreenStream(stream);
        setIsScreenSharing(true);
        setPinnedSpeakerEmail('__screen_share__');
        setLayoutMode('speaker');

        stream.getVideoTracks()[0].onended = () => {
          if (screenStreamRef.current) {
            screenStreamRef.current.getTracks().forEach((track) => {
              try { track.stop(); } catch {}
            });
            screenStreamRef.current = null;
          }
          setIsScreenSharing(false);
          setScreenStream(null);
          setPinnedSpeakerEmail((prev) => (prev === '__screen_share__' ? null : prev));
        };
      } catch (err) {
        console.warn('Screen share canceled or failed:', err);
      }
    } else {
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => {
          try { track.stop(); } catch {}
        });
        screenStreamRef.current = null;
      }
      if (screenStream) {
        screenStream.getTracks().forEach((track) => {
          try { track.stop(); } catch {}
        });
        setScreenStream(null);
      }
      setIsScreenSharing(false);
      setPinnedSpeakerEmail((prev) => (prev === '__screen_share__' ? null : prev));
    }
  };

  // Send In-Room Message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const now = new Date();
    const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(
      now.getMinutes()
    ).padStart(2, '0')}`;

    const newMsg: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      senderName: `${user?.first_name || ''} ${user?.last_name || ''}`.trim() || user?.email || 'Participant',
      senderEmail: user?.email || '',
      text: chatInput.trim(),
      timestamp: timeStr,
      isSelf: true,
    };

    setMessages((prev) => [...prev, newMsg]);
    setChatInput('');
  };

  // Send Mid-Meeting Invites
  const handleSendInvite = async () => {
    if (!inviteEmailInput.trim() || !meeting) return;
    try {
      const res = await api.post(`/meetings/${meeting.id}/invite/`, {
        invitees: [inviteEmailInput.trim().toLowerCase()],
      });
      setInviteSuccess(`Invitation email & calendar invite dispatched to ${inviteEmailInput}!`);
      setInviteEmailInput('');
      if (res.participants) {
        setParticipants(res.participants);
      }
      setTimeout(() => setInviteSuccess(null), 3500);
    } catch (err) {
      coreAlert({
        title: 'Invite Failed',
        description: extractErrorMessage(err) || 'Failed to dispatch meeting invitation.',
        variant: 'destructive',
      });
    }
  };

  // Leave Meeting Execution
  const executeLeaveMeeting = async () => {
    stopAllMediaTracks();
    try {
      await api.post(`/meetings/room/${roomCode}/leave/`, {
        guest_email: guestInfo?.email,
      });
    } catch {}
    setIsLeaveModalOpen(false);
    if (user) {
      navigate('/meetings');
    } else {
      setGuestInfo(null);
      sessionStorage.removeItem(`guest_info_${roomCode}`);
      window.location.href = '/login';
    }
  };

  // End Meeting for All (Host action)
  const executeEndMeeting = async () => {
    try {
      setIsEnding(true);
      stopAllMediaTracks();
      await api.post(`/meetings/room/${roomCode}/end/`);
      setIsEndModalOpen(false);
      if (meeting) {
        navigate(`/meetings/${meeting.id}`);
      } else {
        navigate('/meetings');
      }
    } catch (err) {
      coreAlert({
        title: 'End Meeting Failed',
        description: extractErrorMessage(err) || 'Failed to end meeting.',
        variant: 'destructive',
      });
    } finally {
      setIsEnding(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // If user is not logged in and hasn't checked in as a guest, render Candidate Lobby
  if (!user && !guestInfo) {
    return (
      <div className="fixed inset-0 bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-8 z-50 overflow-y-auto select-none">
        {/* Top Lobby Bar */}
        <div className="max-w-5xl mx-auto w-full flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/25">
              C
            </div>
            <div>
              <h1 className="font-bold text-base text-white">CORE Video Interview</h1>
              <p className="text-xs text-slate-400">Guest Candidate Join Portal</p>
            </div>
          </div>
          <div>
            <span className="text-xs font-mono bg-slate-900 border border-slate-800 text-slate-300 px-3 py-1 rounded-full">
              Room: {roomCode}
            </span>
          </div>
        </div>

        {/* Main Lobby Form & Hardware Preview Grid */}
        <div className="max-w-5xl mx-auto w-full my-auto py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left: Live Camera & Mic Hardware Preview */}
          <div className="lg:col-span-7 flex flex-col items-center">
            <div className="w-full aspect-video max-w-xl bg-slate-900 rounded-3xl overflow-hidden border border-slate-800 shadow-2xl relative flex items-center justify-center">
              {isLocalVideoActive ? (
                <VideoStreamPlayer
                  stream={localStream}
                  muted
                  isMirror={true}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
                  <div className="h-20 w-20 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400">
                    <VideoOff className="h-8 w-8" />
                  </div>
                  <span className="text-sm font-semibold text-slate-300">Camera is turned off</span>
                  <p className="text-xs text-slate-500 max-w-xs">
                    You can toggle your camera or microphone below to test your audio & video before joining.
                  </p>
                </div>
              )}

              {/* Floating Controls over Preview */}
              <div className="absolute bottom-4 flex items-center gap-3 bg-slate-950/80 backdrop-blur-md px-4 py-2 rounded-2xl border border-slate-800 shadow-xl">
                <button
                  type="button"
                  onClick={toggleAudio}
                  className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
                    isAudioMuted || !localStream
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
                  title={isAudioMuted ? 'Unmute Mic' : 'Mute Mic'}
                >
                  {isAudioMuted || !localStream ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={toggleVideo}
                  className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
                    !isLocalVideoActive
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
                  title={!isLocalVideoActive ? 'Turn On Camera' : 'Turn Off Camera'}
                >
                  {!isLocalVideoActive ? <VideoOff className="h-4 w-4" /> : <VideoIcon className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeviceSettingsOpen(true)}
                  className="h-10 w-10 rounded-xl flex items-center justify-center bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all"
                  title="Audio & Video Settings"
                >
                  <Settings className="h-4 w-4" />
                </button>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3 text-center">
              {isLocalSpeaking ? '🟢 Audio detected' : 'Microphone & camera ready for interview'}
            </p>
          </div>

          {/* Right: Candidate Entry Card */}
          <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 p-6 sm:p-8 rounded-3xl shadow-2xl backdrop-blur-xl">
            <div className="mb-6 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-400 bg-indigo-950/60 border border-indigo-900/50 px-2.5 py-1 rounded-full">
                Interview Room
              </span>
              <h2 className="text-2xl font-bold text-white pt-2">
                {meeting?.title || 'Candidate Interview'}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Welcome! Please enter your name and email to enter the interview session. No account or password required.
              </p>
            </div>

            <form onSubmit={handleGuestJoinSubmit} className="space-y-4">
              {guestFormError && (
                <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                  <span>{guestFormError}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Your Full Name</label>
                <Input
                  value={guestNameInput}
                  onChange={(e) => setGuestNameInput(e.target.value)}
                  placeholder="e.g. Alex Doe"
                  className="bg-slate-950 border-slate-800 text-white text-sm h-11 rounded-xl focus:border-indigo-500"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">Your Email Address</label>
                <Input
                  type="email"
                  value={guestEmailInput}
                  onChange={(e) => setGuestEmailInput(e.target.value)}
                  placeholder="e.g. alex.doe@example.com"
                  className="bg-slate-950 border-slate-800 text-white text-sm h-11 rounded-xl focus:border-indigo-500"
                />
              </div>

              {meeting?.requires_passcode && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Meeting Passcode</label>
                  <Input
                    type="password"
                    value={guestPasscodeInput}
                    onChange={(e) => setGuestPasscodeInput(e.target.value)}
                    placeholder="Enter room passcode"
                    className="bg-slate-950 border-slate-800 text-white text-sm h-11 rounded-xl focus:border-indigo-500"
                  />
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-600/30 transition-all gap-2 mt-2"
              >
                <VideoIcon className="h-4 w-4" />
                <span>Join Interview Room</span>
              </Button>
            </form>

            <div className="mt-6 pt-5 border-t border-slate-800/80 text-center">
              <p className="text-[11px] text-slate-500">
                Are you an employee?{' '}
                <a href="/login" className="text-indigo-400 hover:underline font-semibold">
                  Sign in with CORE account
                </a>
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="max-w-5xl mx-auto w-full text-center text-xs text-slate-500 py-2">
          Protected by CORE Enterprise Real-Time Infrastructure
        </div>
      </div>
    );
  }

  // Render Fullscreen Waiting Room Screen
  if (isInWaitingRoom) {
    return (
      <div className="fixed inset-0 bg-slate-950 text-white flex flex-col items-center justify-center p-6 z-50 select-none">
        <div className="max-w-md w-full p-8 rounded-3xl bg-slate-900/90 border border-slate-800 backdrop-blur-xl text-center shadow-2xl space-y-6 animate-in fade-in zoom-in duration-300">
          <div className="h-20 w-20 mx-auto rounded-full bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
            <Hourglass className="h-10 w-10 text-amber-400 animate-spin" />
          </div>
          <div className="space-y-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 bg-amber-950/60 border border-amber-900/50 px-2.5 py-1 rounded-full">
              Waiting for Host
            </span>
            <h2 className="text-2xl font-bold text-white pt-2">
              {meeting?.title || 'Waiting Room'}
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed">
              Hello <span className="text-white font-semibold">{guestInfo?.name || user?.first_name || 'Candidate'}</span>! The interviewer will admit you into the live video session shortly.
            </p>
          </div>

          {/* Camera preview during waiting */}
          <div className="w-full aspect-video max-w-xs mx-auto bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 relative flex items-center justify-center">
            {isLocalVideoActive ? (
              <VideoStreamPlayer
                stream={localStream}
                muted
                isMirror={true}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="text-xs text-slate-500 flex flex-col items-center gap-1.5">
                <VideoOff className="h-6 w-6 text-slate-600" />
                <span>Camera Off</span>
              </div>
            )}
            <div className="absolute bottom-2 flex items-center gap-2 bg-slate-900/90 px-3 py-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={toggleAudio}
                className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs ${
                  isAudioMuted ? 'bg-rose-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                {isAudioMuted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
              </button>
              <button
                type="button"
                onClick={toggleVideo}
                className={`h-7 w-7 rounded-lg flex items-center justify-center text-xs ${
                  !isLocalVideoActive ? 'bg-rose-500 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                {!isLocalVideoActive ? <VideoOff className="h-3.5 w-3.5" /> : <VideoIcon className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 text-xs font-mono text-slate-400 flex items-center justify-center gap-2">
            <Lock className="h-3.5 w-3.5 text-amber-500" />
            <span>Room: {roomCode}</span>
          </div>

          <Button
            onClick={() => {
              if (user) {
                navigate('/meetings');
              } else {
                setGuestInfo(null);
                sessionStorage.removeItem(`guest_info_${roomCode}`);
                setIsInWaitingRoom(false);
              }
            }}
            variant="outline"
            className="border-slate-800 hover:bg-slate-800 text-xs text-slate-300 w-full font-semibold"
          >
            Leave Waiting Room
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-white flex flex-col z-50 overflow-hidden select-none">
      {/* Top Meeting Header Bar */}
      <header className="h-16 px-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shadow-sm shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
            </span>
            <span className="font-mono text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider bg-rose-50 dark:bg-rose-950/40 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-900/50">
              REC {formatSeconds(meetingDuration)}
            </span>
          </div>

          <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

          <div className="min-w-0">
            <h1 className="font-bold text-sm sm:text-base text-slate-900 dark:text-white truncate">
              {meeting?.title || 'Video Conference'}
            </h1>
            <p className="text-[11px] text-slate-500 font-mono truncate">
              Room: {roomCode}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Layout View Mode Toggle */}
          <button
            type="button"
            onClick={() => setLayoutMode(layoutMode === 'grid' ? 'speaker' : 'grid')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-colors"
            title={layoutMode === 'grid' ? 'Switch to Spotlight Speaker View' : 'Switch to Gallery Grid View'}
          >
            {layoutMode === 'grid' ? <LayoutGrid className="h-3.5 w-3.5 text-indigo-500" /> : <Maximize2 className="h-3.5 w-3.5 text-indigo-500" />}
            <span className="hidden md:inline">{layoutMode === 'grid' ? 'Grid View' : 'Speaker View'}</span>
          </button>

          {/* Speaker Queue Counter Pill in Header */}
          {raisedHands.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSidebarTab('participants');
                setIsSidebarOpen(true);
              }}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 hover:bg-amber-500/25 transition-colors animate-pulse"
              title={`${raisedHands.length} hands raised in speaker queue`}
            >
              <span>✋</span>
              <span>{raisedHands.length} Queued</span>
            </button>
          )}

          {/* Agenda Pill in Header */}
          {agendaItems.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setSidebarTab('agenda');
                setIsSidebarOpen(true);
              }}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-900/50 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
            >
              <CheckSquare className="h-3.5 w-3.5" />
              <span>
                Agenda: {agendaItems.filter((i) => i.is_completed).length}/{agendaItems.length}
              </span>
            </button>
          )}

          {/* Host Room Lock Button */}
          {isHost && (
            <Button
              onClick={handleToggleLock}
              variant="outline"
              size="sm"
              className={`border-slate-200 dark:border-slate-700 text-xs font-semibold gap-1.5 h-9 ${
                isLocked
                  ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-900/50'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {isLocked ? <Lock className="h-3.5 w-3.5 text-rose-500" /> : <Unlock className="h-3.5 w-3.5 text-slate-400" />}
              <span className="hidden sm:inline">{isLocked ? 'Room Locked' : 'Lock Room'}</span>
            </Button>
          )}

          <Button
            onClick={handleCopyLink}
            variant="outline"
            size="sm"
            className="border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold gap-1.5 h-9"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
            <span>{copiedLink ? 'Copied' : 'Share Link'}</span>
          </Button>

          <Button
            onClick={() => setIsInviteOpen(true)}
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold gap-1.5 shadow-sm h-9"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Invite Person</span>
          </Button>

        </div>
      </header>

      {/* Main Conference Room Center Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Video Grid & Captions Viewport */}
        <div className="flex-1 flex flex-col p-4 sm:p-6 overflow-hidden relative bg-slate-100/70 dark:bg-slate-950">
          {/* Host Waiting Room Notification Banner */}
          {isHost && waitingParticipants.length > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 backdrop-blur-md rounded-2xl p-3 px-4 mb-4 flex items-center justify-between text-xs text-amber-300 shadow-lg animate-in slide-in-from-top duration-300 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <Hourglass className="h-4 w-4 text-amber-400 animate-pulse shrink-0" />
                <span className="font-semibold shrink-0">
                  {waitingParticipants.length} guest(s) waiting:
                </span>
                <span className="font-bold text-white truncate max-w-xs sm:max-w-md">
                  {waitingParticipants.map((p) => p.name || p.email).join(', ')}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {waitingParticipants.map((p) => (
                  <div key={p.id} className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      onClick={() => handleAdmitParticipant(p.id, 'admit')}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold h-7 px-2.5 gap-1"
                    >
                      <UserCheck className="h-3 w-3" /> Admit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleAdmitParticipant(p.id, 'decline')}
                      className="border-rose-500/30 text-rose-400 hover:bg-rose-500/10 text-[11px] font-bold h-7 px-2.5 gap-1"
                    >
                      <UserX className="h-3 w-3" /> Decline
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Speaker Queue Banner */}
          {raisedHands.length > 0 && (
            <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/10 to-transparent border border-amber-500/30 backdrop-blur-md rounded-2xl p-3 px-4 mb-4 flex items-center justify-between text-xs text-amber-200 shadow-lg animate-in slide-in-from-top duration-300 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="h-7 w-7 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold shrink-0">
                  ✋
                </div>
                <div className="min-w-0">
                  <div className="font-bold flex items-center gap-2 text-amber-300">
                    <span>Speaker Queue ({raisedHands.length})</span>
                  </div>
                  <div className="text-[11px] text-slate-300 truncate max-w-xs sm:max-w-md md:max-w-xl">
                    {raisedHands.map((h, i) => `${i + 1}. ${h.name}`).join(' • ')}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                {isHost && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleLowerAllHands}
                    className="border-amber-500/40 text-amber-300 hover:bg-amber-500/20 text-[11px] font-bold h-7 px-2.5"
                  >
                    Lower All
                  </Button>
                )}
                {isMyHandRaised && (
                  <Button
                    size="sm"
                    onClick={() => handleToggleHand('lower')}
                    className="bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold h-7 px-2.5"
                  >
                    Lower My Hand
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Camera / Mic Error Notice Banner */}
          {mediaError && (
            <div className="bg-rose-500/15 border border-rose-500/35 backdrop-blur-md rounded-2xl p-3 px-4 mb-4 flex items-center justify-between text-xs text-rose-300 shadow-lg animate-in slide-in-from-top duration-300 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <AlertCircle className="h-4 w-4 text-rose-400 shrink-0 animate-pulse" />
                <span className="font-semibold">{mediaError}</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={initUserMedia}
                className="border-rose-500/40 text-rose-300 hover:bg-rose-500/20 text-[11px] font-bold h-7 px-3 shrink-0 ml-3"
              >
                Retry Camera Access
              </Button>
            </div>
          )}

          {/* Floating In-Meeting Reactions Layer */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-30">
            {floatingReactions.map((r) => (
              <div
                key={r.id}
                className="absolute bottom-20 flex flex-col items-center animate-float-reaction"
                style={{ left: `${r.xOffset}%` }}
              >
                <div className="text-4xl filter drop-shadow-lg select-none mb-1">
                  {r.emoji}
                </div>
                <span className="bg-slate-900/80 backdrop-blur-md text-[10px] text-white font-medium px-2 py-0.5 rounded-full border border-slate-700 shadow-md">
                  {r.senderName}
                </span>
              </div>
            ))}
          </div>

          <style>{`
            @keyframes floatUpAndFade {
              0% {
                transform: translateY(0px) scale(0.6);
                opacity: 0;
              }
              15% {
                transform: translateY(-25px) scale(1.25);
                opacity: 1;
              }
              80% {
                transform: translateY(-160px) scale(1.05);
                opacity: 0.9;
              }
              100% {
                transform: translateY(-220px) scale(0.9);
                opacity: 0;
              }
            }
            .animate-float-reaction {
              animation: floatUpAndFade 3.2s cubic-bezier(0.22, 1, 0.36, 1) forwards;
            }
          `}</style>

          <div className="flex-1 min-h-0 flex flex-col">
            {stageMode === 'code' ? (
              <div className="flex-1 flex flex-col min-h-0 relative">
                <MeetingCodeSandbox
                  roomCode={roomCode!}
                  isHost={isHost}
                  userName={user?.first_name || user?.email}
                  onClose={() => setStageMode('video')}
                />
              </div>
            ) : stageMode === 'whiteboard' ? (
              <div className="flex-1 flex flex-col min-h-0 relative">
                <MeetingWhiteboard
                  roomCode={roomCode!}
                  isHost={isHost}
                  userName={user?.first_name || user?.email}
                  onClose={() => setStageMode('video')}
                />
              </div>
            ) : stageMode === 'framework' ? (
              <div className="flex-1 flex flex-col min-h-0 relative">
                <MeetingFrameworkStage
                  roomCode={roomCode!}
                  templateType={meeting?.template_type || 'retro'}
                  isHost={isHost}
                  userEmail={user?.email}
                  userName={user?.first_name || user?.email}
                  onClose={() => setStageMode('video')}
                />
              </div>
            ) : presentationDoc ? (
              <div className="flex-1 flex flex-col min-h-0 bg-slate-900 rounded-2xl border border-slate-700/60 shadow-xl overflow-hidden relative">
                {/* Presentation Stage Top Bar */}
                <div className="h-12 bg-slate-950/90 border-b border-slate-800 px-4 flex items-center justify-between shrink-0 text-white">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Presentation className="h-4 w-4 text-primary shrink-0" />
                    <span className="font-bold text-xs truncate max-w-xs sm:max-w-md">
                      {presentationDoc.title}
                    </span>
                    <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-semibold shrink-0">
                      Presenter: {presentationDoc.presenter_name || (presentationDoc.presenter_email === user?.email ? 'You' : 'Stage Presenter')}
                    </span>
                  </div>

                  {/* Stage Page Navigation & Zoom Controls */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUpdatePresentationPage(Math.max(1, presentationPage - 1))}
                        className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
                        title="Previous Page"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                      <span className="px-2 font-mono text-[11px] text-slate-200">
                        Page {presentationPage}
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUpdatePresentationPage(presentationPage + 1)}
                        className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
                        title="Next Page"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Zoom Controls */}
                    <div className="hidden sm:flex items-center bg-slate-800 rounded-lg p-0.5 border border-slate-700 text-xs">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setPresentationZoom((z) => Math.max(50, z - 10))}
                        className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
                        title="Zoom Out"
                      >
                        <ZoomOut className="h-3.5 w-3.5" />
                      </Button>
                      <span className="px-1.5 font-mono text-[11px] text-slate-300">
                        {presentationZoom}%
                      </span>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setPresentationZoom((z) => Math.min(200, z + 10))}
                        className="h-7 w-7 p-0 text-slate-300 hover:text-white hover:bg-slate-700"
                        title="Zoom In"
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                      </Button>
                    </div>

                    {/* Open in New Tab & Stop Presenting */}
                    {presentationDoc.url && (
                      <a
                        href={presentationDoc.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition-colors"
                        title="Open document in new browser tab"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span className="hidden md:inline">Open Full Tab</span>
                      </a>
                    )}

                    {(isHost || presentationDoc.presenter_email === user?.email) && (
                      <Button
                        size="sm"
                        onClick={handleStopPresenting}
                        className="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold h-7 px-2.5 gap-1 shadow-sm"
                      >
                        <X className="h-3.5 w-3.5" /> Stop Presenting
                      </Button>
                    )}
                  </div>
                </div>

                {/* Presentation Content Viewer */}
                <div className="flex-1 overflow-auto bg-slate-950 flex items-center justify-center p-2 relative">
                  {presentationDoc.url ? (
                    presentationDoc.file_type === 'pdf' || presentationDoc.url.toLowerCase().includes('.pdf') ? (
                      <div className="w-full h-full flex flex-col items-center justify-center relative bg-slate-900 rounded-xl overflow-hidden border border-slate-800">
                        <object
                          data={presentationDoc.url}
                          type="application/pdf"
                          className="w-full h-full rounded-xl bg-white"
                          style={{ transform: `scale(${presentationZoom / 100})`, transformOrigin: 'top center' }}
                        >
                          <div className="flex flex-col items-center justify-center p-8 text-center text-slate-300 space-y-3">
                            <FileText className="h-12 w-12 text-primary opacity-70 mb-2" />
                            <h4 className="font-bold text-sm text-white">{presentationDoc.title}</h4>
                            <p className="text-xs text-slate-400 max-w-sm">
                              Browser inline preview could not render this PDF. Click below to view the full PDF document in a new tab.
                            </p>
                            <a
                              href={presentationDoc.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-bold hover:bg-primary/90 transition-colors shadow-md"
                            >
                              <ExternalLink className="h-4 w-4" /> Open PDF in New Tab
                            </a>
                          </div>
                        </object>
                      </div>
                    ) : (
                      <iframe
                        src={presentationDoc.url}
                        title={presentationDoc.title}
                        className="w-full h-full bg-white rounded-xl border border-slate-800"
                        style={{ transform: `scale(${presentationZoom / 100})`, transformOrigin: 'top center' }}
                      />
                    )
                  ) : (
                    <div
                      className="w-full h-full bg-white dark:bg-slate-900 rounded-xl p-8 overflow-y-auto text-slate-900 dark:text-slate-100 shadow-inner border border-slate-800"
                      style={{ zoom: `${presentationZoom}%` }}
                    >
                      <div className="max-w-3xl mx-auto space-y-4">
                        <div className="border-b border-slate-200 dark:border-slate-800 pb-3">
                          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{presentationDoc.title}</h2>
                          <p className="text-xs text-slate-500">Live Stage Document Presentation</p>
                        </div>
                        <div className="prose prose-slate dark:prose-invert max-w-none text-sm leading-relaxed">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                            {presentationDoc.content || 'Document preview not available.'}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Floating Participant Video Row in Presentation Mode */}
                  <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-slate-950/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-800 shadow-2xl z-20">
                    <div className="w-28 h-20 bg-slate-900 rounded-xl overflow-hidden border border-slate-700 relative">
                      {isLocalVideoActive ? (
                        <VideoStreamPlayer
                          stream={localStream}
                          muted
                          isMirror
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-xs font-bold text-slate-400 bg-slate-800">
                          <span>{user?.first_name?.[0] || 'You'}</span>
                          <span className="text-[9px] text-slate-500 font-normal">Off</span>
                        </div>
                      )}
                      <span className="absolute bottom-1 left-1 bg-slate-950/80 px-1 py-0.5 rounded text-[9px] text-white">
                        You
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ) : layoutMode === 'speaker' ? (
              /* Spotlight Speaker View */
              <div className="flex-1 flex flex-col min-h-0 gap-3">
                {/* Horizontal Filmstrip of other participants */}
                <div className="h-28 flex items-center gap-3 overflow-x-auto p-1 shrink-0 scrollbar-thin">
                  {/* Screen share tile in filmstrip if active */}
                  {isScreenSharing && (
                    <div className="relative w-44 h-full bg-slate-900 rounded-xl overflow-hidden border border-primary/50 shrink-0">
                      <VideoStreamPlayer
                        stream={screenStream}
                        muted
                        isMirror={false}
                        className="w-full h-full object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => setPinnedSpeakerEmail(pinnedSpeakerEmail === '__screen_share__' ? null : '__screen_share__')}
                        className="absolute top-1.5 left-1.5 p-1 rounded-md bg-black/50 text-slate-300 hover:text-white"
                        title={pinnedSpeakerEmail === '__screen_share__' ? 'Unpin Screen' : 'Spotlight Screen'}
                      >
                        {pinnedSpeakerEmail === '__screen_share__' ? <PinOff className="h-3 w-3 text-primary" /> : <Pin className="h-3 w-3" />}
                      </button>
                      <span className="absolute bottom-1 left-1.5 bg-slate-950/80 px-1.5 py-0.5 rounded text-[9px] text-primary font-bold">
                        Screen Share
                      </span>
                    </div>
                  )}

                  {/* Local tile in filmstrip if not spotlighted */}
                  {!(pinnedSpeakerEmail === user?.email || (!pinnedSpeakerEmail && activeSpeakerEmail === user?.email) || (!pinnedSpeakerEmail && !activeSpeakerEmail && participants.filter(p => p.email.toLowerCase() !== user?.email?.toLowerCase()).length === 0 && pinnedSpeakerEmail !== '__screen_share__')) && (
                    <div className={`relative w-44 h-full bg-slate-900 rounded-xl overflow-hidden border shrink-0 transition-all ${
                      (isLocalSpeaking || activeSpeakerEmail === user?.email) ? 'ring-2 ring-emerald-500 border-emerald-400' : 'border-slate-800'
                    }`}>
                      {isLocalVideoActive ? (
                        <VideoStreamPlayer
                          stream={localStream}
                          muted
                          isMirror
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-slate-400 bg-slate-900/60">
                          <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300">
                            {user?.first_name?.[0] || 'Y'}
                          </div>
                          <span className="text-[10px]">Camera Off</span>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setPinnedSpeakerEmail(user?.email || null)}
                        className="absolute top-1.5 left-1.5 p-1 rounded-md bg-black/50 text-slate-300 hover:text-white"
                        title="Spotlight You"
                      >
                        <Pin className="h-3 w-3" />
                      </button>
                      {raisedHands.findIndex(h => h.email?.toLowerCase() === user?.email?.toLowerCase()) !== -1 && (
                        <span className="absolute top-1.5 right-1.5 bg-amber-500 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-md">
                          ✋ #{raisedHands.findIndex(h => h.email?.toLowerCase() === user?.email?.toLowerCase()) + 1}
                        </span>
                      )}
                      <span className="absolute bottom-1 left-1.5 bg-slate-950/80 px-1.5 py-0.5 rounded text-[9px] text-white">
                        You
                      </span>
                    </div>
                  )}

                  {/* Remote peers in filmstrip */}
                  {participants
                    .filter((p) => p.email.toLowerCase() !== user?.email?.toLowerCase())
                    .map((peer) => {
                      const isThisSpotlight = (pinnedSpeakerEmail === peer.email) || (!pinnedSpeakerEmail && activeSpeakerEmail === peer.email) || (!pinnedSpeakerEmail && !activeSpeakerEmail && peer === participants.filter(p => p.email.toLowerCase() !== user?.email?.toLowerCase())[0] && pinnedSpeakerEmail !== '__screen_share__');
                      if (isThisSpotlight) return null;
                      const isPeerActive = activeSpeakerEmail?.toLowerCase() === peer.email?.toLowerCase();
                      const pHandIdx = raisedHands.findIndex((h) => h.email?.toLowerCase() === peer.email?.toLowerCase());

                      return (
                        <div
                          key={peer.id || peer.email}
                          className={`relative w-44 h-full bg-slate-900 rounded-xl overflow-hidden border shrink-0 transition-all ${
                            isPeerActive ? 'ring-2 ring-emerald-500 border-emerald-400' : 'border-slate-800'
                          }`}
                        >
                          <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                            <div className="h-9 w-9 rounded-full bg-purple-900/40 border border-purple-700/50 flex items-center justify-center text-purple-300 font-bold text-xs">
                              {peer.name?.[0] || peer.email[0].toUpperCase()}
                            </div>
                            <span className="text-[10px] font-semibold text-slate-300 truncate max-w-[120px]">{peer.name}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => setPinnedSpeakerEmail(peer.email)}
                            className="absolute top-1.5 left-1.5 p-1 rounded-md bg-black/50 text-slate-300 hover:text-white"
                            title="Spotlight Speaker"
                          >
                            <Pin className="h-3 w-3" />
                          </button>
                          {pHandIdx !== -1 && (
                            <span className="absolute top-1.5 right-1.5 bg-amber-500 text-white font-bold text-[9px] px-1.5 py-0.5 rounded-md">
                              ✋ #{pHandIdx + 1}
                            </span>
                          )}
                          <span className="absolute bottom-1 left-1.5 bg-slate-950/80 px-1.5 py-0.5 rounded text-[9px] text-white truncate max-w-[120px]">
                            {peer.name}
                          </span>
                        </div>
                      );
                    })}
                </div>

                {/* Main Spotlight Center Stage */}
                {(() => {
                  const remPeers = participants.filter((p) => p.email.toLowerCase() !== user?.email?.toLowerCase());
                  const activePeer = remPeers.find((p) => p.email.toLowerCase() === activeSpeakerEmail?.toLowerCase());
                  const pinnedPeer = remPeers.find((p) => p.email.toLowerCase() === pinnedSpeakerEmail?.toLowerCase());
                  const isScreenPinned = pinnedSpeakerEmail === '__screen_share__';
                  const isUserPinned = pinnedSpeakerEmail === user?.email;
                  const isUserActive = !pinnedSpeakerEmail && (activeSpeakerEmail === user?.email || remPeers.length === 0);
                  const showLocalInSpotlight = !isScreenPinned && (isUserPinned || isUserActive);
                  const spotlightTarget = pinnedPeer || activePeer || remPeers[0];

                  return (
                    <div className="flex-1 min-h-0 relative bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
                      {isScreenPinned && isScreenSharing ? (
                        /* Screen Share Spotlight */
                        <div className="relative w-full h-full flex items-center justify-center bg-slate-950">
                          <VideoStreamPlayer
                            stream={screenStream}
                            muted
                            isMirror={false}
                            className="w-full h-full object-contain"
                          />
                          <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                            <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-xl shadow-md flex items-center gap-1.5">
                              <MonitorUp className="h-3.5 w-3.5" />
                              Spotlight: Shared Screen
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPinnedSpeakerEmail(null)}
                              className="h-7 px-2 text-xs text-white bg-black/50 hover:bg-black/70 gap-1 rounded-lg"
                            >
                              <PinOff className="h-3 w-3" /> Unpin
                            </Button>
                          </div>
                        </div>
                      ) : showLocalInSpotlight ? (
                        /* Local User Spotlight */
                        <div className={`relative w-full h-full flex items-center justify-center ${
                          (isLocalSpeaking || activeSpeakerEmail === user?.email) ? 'ring-4 ring-emerald-500/90 shadow-emerald-500/25 shadow-2xl' : ''
                        }`}>
                          {isLocalVideoActive ? (
                            <VideoStreamPlayer
                              stream={localStream}
                              muted
                              isMirror
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="flex flex-col items-center justify-center gap-3">
                              <div className="h-28 w-28 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-extrabold text-4xl">
                                {user?.first_name?.[0] || user?.email[0].toUpperCase()}
                              </div>
                              <span className="text-sm font-semibold text-slate-400">
                                {mediaError ? 'Camera Unavailable' : 'Camera Off'}
                              </span>
                              {mediaError && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={initUserMedia}
                                  className="text-xs h-7 px-3 border-slate-700 text-slate-300 hover:text-white"
                                >
                                  Retry Camera Access
                                </Button>
                              )}
                            </div>
                          )}
                          <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                            <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-xl shadow-md">
                              Spotlight: You
                            </span>
                            {pinnedSpeakerEmail && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setPinnedSpeakerEmail(null)}
                                className="h-7 px-2 text-xs text-white bg-black/50 hover:bg-black/70 gap-1 rounded-lg"
                              >
                                <PinOff className="h-3 w-3" /> Unpin
                              </Button>
                            )}
                          </div>
                          {raisedHands.findIndex((h) => h.email?.toLowerCase() === user?.email?.toLowerCase()) !== -1 && (
                            <div className="absolute top-3 right-3 bg-amber-500 text-white font-bold text-xs px-3 py-1 rounded-xl shadow-lg border border-amber-400 flex items-center gap-1.5 animate-bounce z-10">
                              ✋ #{raisedHands.findIndex((h) => h.email?.toLowerCase() === user?.email?.toLowerCase()) + 1}
                            </div>
                          )}
                          <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-800 dark:text-white border border-slate-800 flex items-center gap-2 shadow-sm z-10">
                            <span>{user?.first_name} {user?.last_name} (You)</span>
                            {isAudioMuted ? (
                              <MicOff className="h-3.5 w-3.5 text-rose-500" />
                            ) : isLocalSpeaking ? (
                              <div className="flex items-center gap-1 text-emerald-400">
                                <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Speaking</span>
                              </div>
                            ) : (
                              <Volume2 className="h-3.5 w-3.5 text-slate-400" />
                            )}
                          </div>
                        </div>
                      ) : spotlightTarget ? (
                        /* Remote Peer Spotlight */
                        <div className={`relative w-full h-full flex items-center justify-center ${
                          activeSpeakerEmail?.toLowerCase() === spotlightTarget.email?.toLowerCase() ? 'ring-4 ring-emerald-500/90 shadow-emerald-500/25 shadow-2xl' : ''
                        }`}>
                          <div className="flex flex-col items-center justify-center gap-4">
                            <div className="h-32 w-32 rounded-full bg-purple-950/50 border border-purple-800/60 flex items-center justify-center text-purple-300 font-extrabold text-5xl">
                              {spotlightTarget.name?.[0] || spotlightTarget.email[0].toUpperCase() || 'P'}
                            </div>
                            <div className="text-center">
                              <h3 className="text-lg font-bold text-white">{spotlightTarget.name || 'Participant'}</h3>
                              <p className="text-xs text-slate-400">{spotlightTarget.email}</p>
                            </div>
                          </div>
                          <div className="absolute top-3 left-3 flex items-center gap-2 z-10">
                            <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-xl shadow-md">
                              Spotlight: {spotlightTarget.name || 'Speaker'}
                            </span>
                            {pinnedSpeakerEmail && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setPinnedSpeakerEmail(null)}
                                className="h-7 px-2 text-xs text-white bg-black/50 hover:bg-black/70 gap-1 rounded-lg"
                              >
                                <PinOff className="h-3 w-3" /> Unpin
                              </Button>
                            )}
                          </div>
                          {raisedHands.findIndex((h) => h.email?.toLowerCase() === spotlightTarget.email?.toLowerCase()) !== -1 && (
                            <div className="absolute top-3 right-3 bg-amber-500 text-white font-bold text-xs px-3 py-1 rounded-xl shadow-lg border border-amber-400 flex items-center gap-1.5 animate-bounce z-10">
                              ✋ #{raisedHands.findIndex((h) => h.email?.toLowerCase() === spotlightTarget.email?.toLowerCase()) + 1}
                            </div>
                          )}
                          <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-800 dark:text-white border border-slate-800 flex items-center gap-2 shadow-sm z-10">
                            <span>{spotlightTarget.name}</span>
                            {activeSpeakerEmail?.toLowerCase() === spotlightTarget.email?.toLowerCase() ? (
                              <div className="flex items-center gap-1 text-emerald-400">
                                <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">Speaking</span>
                              </div>
                            ) : (
                              <Volume2 className="h-3.5 w-3.5 text-slate-400" />
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })()}
              </div>
            ) : (
              /* Gallery Grid View */
              (() => {
                const remPeers = participants.filter((p) => p.email.toLowerCase() !== user?.email?.toLowerCase());
                const isSingleUserAlone = remPeers.length === 0 && !isScreenSharing;
                const totalGridItems = (isScreenSharing ? 1 : 0) + 1 + remPeers.length;

                if (isSingleUserAlone) {
                  return (
                    <div className="flex-1 flex items-center justify-center min-h-0 p-2 sm:p-4">
                      <div className={`relative w-full max-w-4xl aspect-video bg-slate-900 rounded-3xl overflow-hidden border transition-all duration-300 shadow-2xl flex items-center justify-center ${
                        (isLocalSpeaking || activeSpeakerEmail === user?.email)
                          ? 'ring-4 ring-emerald-500/90 border-emerald-400 shadow-emerald-500/25'
                          : 'border-slate-200 dark:border-slate-800'
                      }`}>
                        {isLocalVideoActive ? (
                          <VideoStreamPlayer
                            stream={localStream}
                            muted
                            isMirror
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-3">
                            <div className="h-28 w-28 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-extrabold text-4xl">
                              {user?.first_name?.[0] || user?.email[0].toUpperCase()}
                            </div>
                            <span className="text-sm font-semibold text-slate-400">
                              {mediaError ? 'Camera Unavailable' : 'Camera Off'}
                            </span>
                            {mediaError && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={initUserMedia}
                                className="text-xs h-7 px-3 border-slate-700 text-slate-300 hover:text-white"
                              >
                                Retry Camera Access
                              </Button>
                            )}
                          </div>
                        )}

                        {/* Hand Raised Badge */}
                        {raisedHands.findIndex(h => h.email?.toLowerCase() === user?.email?.toLowerCase()) !== -1 && (
                          <div className="absolute top-3 right-3 bg-amber-500 text-white font-bold text-xs px-2.5 py-1 rounded-xl shadow-lg border border-amber-400 flex items-center gap-1.5 animate-bounce z-10">
                            ✋ #{raisedHands.findIndex(h => h.email?.toLowerCase() === user?.email?.toLowerCase()) + 1}
                          </div>
                        )}

                        {/* User Label Tag */}
                        <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-slate-950/80 backdrop-blur-md px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 flex items-center gap-2.5 shadow-sm z-10">
                          <span>{user?.first_name} {user?.last_name} (You)</span>
                          {isAudioMuted ? (
                            <MicOff className="h-3.5 w-3.5 text-rose-500" />
                          ) : isLocalSpeaking ? (
                            <div className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400">
                              <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                              <span className="text-[10px] font-bold uppercase tracking-wider">Speaking</span>
                            </div>
                          ) : (
                            <Volume2 className="h-3.5 w-3.5 text-slate-400" />
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }

                const gridClass = totalGridItems === 2
                  ? 'grid-cols-1 md:grid-cols-2'
                  : totalGridItems <= 4
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-3';

                return (
                  <div className={`flex-1 grid ${gridClass} gap-4 items-center justify-center min-h-0`}>
                    {/* Screen Share Tile (if active) */}
                    {isScreenSharing && (
                      <div className="relative w-full h-full bg-slate-900 rounded-2xl overflow-hidden border border-primary/40 shadow-lg flex items-center justify-center min-h-[220px]">
                        <VideoStreamPlayer
                          stream={screenStream}
                          muted
                          isMirror={false}
                          className="w-full h-full object-contain"
                        />
                        <div className="absolute top-3 left-3 bg-white/90 dark:bg-slate-950/80 backdrop-blur px-3 py-1 rounded-lg text-xs font-semibold text-primary border border-primary/30 flex items-center gap-1.5 shadow-sm">
                          <MonitorUp className="h-3.5 w-3.5" />
                          Your Shared Screen
                        </div>
                      </div>
                    )}

                    {/* Local User Tile */}
                    <div className={`relative w-full h-full bg-slate-900 rounded-2xl overflow-hidden border transition-all duration-300 shadow-md flex items-center justify-center min-h-[220px] ${
                      isScreenSharing ? 'max-h-64' : ''
                    } ${
                      (isLocalSpeaking || activeSpeakerEmail === user?.email)
                        ? 'ring-4 ring-emerald-500/90 border-emerald-400 shadow-emerald-500/25 shadow-2xl'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}>
                      {isLocalVideoActive ? (
                        <VideoStreamPlayer
                          stream={localStream}
                          muted
                          isMirror
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-3">
                          <div className="h-24 w-24 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-extrabold text-3xl">
                            {user?.first_name?.[0] || user?.email[0].toUpperCase()}
                          </div>
                          <span className="text-sm font-semibold text-slate-400">
                            {mediaError ? 'Camera Unavailable' : 'Camera Off'}
                          </span>
                          {mediaError && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={initUserMedia}
                              className="text-xs h-7 px-3 border-slate-700 text-slate-300 hover:text-white"
                            >
                              Retry Camera Access
                            </Button>
                          )}
                        </div>
                      )}

                      {/* Pin Tile */}
                      <button
                        type="button"
                        onClick={() => setPinnedSpeakerEmail(pinnedSpeakerEmail === user?.email ? null : user?.email || null)}
                        className={`absolute top-3 left-3 p-1.5 rounded-xl text-xs font-semibold backdrop-blur-md transition-all z-10 ${
                          pinnedSpeakerEmail === user?.email
                            ? 'bg-primary text-primary-foreground shadow-md'
                            : 'bg-black/40 text-slate-300 hover:text-white hover:bg-black/60'
                        }`}
                        title={pinnedSpeakerEmail === user?.email ? 'Unpin Spotlight' : 'Pin Spotlight'}
                      >
                        {pinnedSpeakerEmail === user?.email ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                      </button>

                      {/* Hand Raised Badge */}
                      {raisedHands.findIndex(h => h.email?.toLowerCase() === user?.email?.toLowerCase()) !== -1 && (
                        <div className="absolute top-3 right-3 bg-amber-500 text-white font-bold text-xs px-2.5 py-1 rounded-xl shadow-lg border border-amber-400 flex items-center gap-1.5 animate-bounce z-10">
                          ✋ #{raisedHands.findIndex(h => h.email?.toLowerCase() === user?.email?.toLowerCase()) + 1}
                        </div>
                      )}

                      {/* User Label Tag */}
                      <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 flex items-center gap-2 shadow-sm z-10">
                        <span>{user?.first_name} {user?.last_name} (You)</span>
                        {isAudioMuted ? (
                          <MicOff className="h-3.5 w-3.5 text-rose-500" />
                        ) : isLocalSpeaking ? (
                          <div className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400">
                            <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                            <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Speaking</span>
                          </div>
                        ) : (
                          <Volume2 className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </div>
                    </div>

                    {/* Remote Peer Tiles */}
                    {remPeers
                      .slice(0, 5)
                      .map((peer, idx) => {
                        const isPeerActive = activeSpeakerEmail?.toLowerCase() === peer.email?.toLowerCase();
                        const peerHandIndex = raisedHands.findIndex((h) => h.email?.toLowerCase() === peer.email?.toLowerCase());

                        return (
                          <div
                            key={peer.id || idx}
                            className={`relative w-full h-full bg-white dark:bg-slate-900 rounded-2xl overflow-hidden border transition-all duration-300 shadow-md flex items-center justify-center min-h-[220px] ${
                              isScreenSharing ? 'max-h-64' : ''
                            } ${
                              isPeerActive
                                ? 'ring-4 ring-emerald-500/90 border-emerald-400 shadow-emerald-500/25 shadow-2xl'
                                : 'border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            <div className="flex flex-col items-center justify-center gap-3">
                              <div className="h-24 w-24 rounded-full bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/40 flex items-center justify-center text-purple-600 dark:text-purple-400 font-extrabold text-3xl">
                                {peer.name?.[0] || peer.email[0].toUpperCase()}
                              </div>
                              <span className="text-sm font-bold text-slate-900 dark:text-white">{peer.name}</span>
                              <span className="text-xs text-slate-400">Connected</span>
                            </div>

                            {/* Pin Peer */}
                            <button
                              type="button"
                              onClick={() => setPinnedSpeakerEmail(pinnedSpeakerEmail === peer.email ? null : peer.email)}
                              className={`absolute top-3 left-3 p-1.5 rounded-xl text-xs font-semibold backdrop-blur-md transition-all z-10 ${
                                pinnedSpeakerEmail === peer.email
                                  ? 'bg-primary text-primary-foreground shadow-md'
                                  : 'bg-black/40 text-slate-300 hover:text-white hover:bg-black/60'
                              }`}
                              title={pinnedSpeakerEmail === peer.email ? 'Unpin Spotlight' : 'Pin Spotlight'}
                            >
                              {pinnedSpeakerEmail === peer.email ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                            </button>

                            {/* Hand Raised Badge */}
                            {peerHandIndex !== -1 && (
                              <div className="absolute top-3 right-3 bg-amber-500 text-white font-bold text-xs px-2.5 py-1 rounded-xl shadow-lg border border-amber-400 flex items-center gap-1.5 animate-bounce z-10">
                                ✋ #{peerHandIndex + 1}
                              </div>
                            )}

                            <div className="absolute bottom-3 left-3 bg-white/90 dark:bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-800 dark:text-white border border-slate-200 dark:border-slate-800 flex items-center gap-2 shadow-sm z-10">
                              <span>{peer.name}</span>
                              {isPeerActive ? (
                                <div className="flex items-center gap-1 text-emerald-500 dark:text-emerald-400">
                                  <Volume2 className="h-3.5 w-3.5 animate-pulse" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Speaking</span>
                                </div>
                              ) : (
                                <Volume2 className="h-3.5 w-3.5 text-slate-400" />
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                );
              })()
            )}
          </div>

          {/* Real-time Subtitles / Live Speech Captions Floating HUD */}
          {(currentSpeechCaption || liveTranscript.length > 0) && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 max-w-2xl w-full px-4 pointer-events-none">
              <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-primary/30 rounded-2xl p-3 px-5 shadow-xl text-center pointer-events-auto">
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary animate-spin" />
                    <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
                      Live Speech Captions
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSidebarTab('transcript');
                      setIsSidebarOpen(true);
                    }}
                    className="text-[10px] font-semibold text-slate-500 hover:text-primary transition-colors flex items-center gap-1"
                    title="Change speech recognition accent in side panel"
                  >
                    <Languages className="h-3 w-3" />
                    <span>{speechLanguage.toUpperCase()}</span>
                  </button>
                </div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 italic leading-relaxed">
                  {currentSpeechCaption ? (
                    <span className="text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse">
                      "{currentSpeechCaption}"
                    </span>
                  ) : liveTranscript.length > 0 ? (
                    `"${liveTranscript[liveTranscript.length - 1].text}"`
                  ) : (
                    ''
                  )}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right Tabbed Meeting Sidebar (Chat, Participants, Live Transcript) */}
        {isSidebarOpen && (
          <aside className="w-80 sm:w-96 bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
            {/* Top Close Header */}
            <div className="h-12 px-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50 dark:bg-slate-950/60">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
                {sidebarTab === 'agenda' && 'Meeting Agenda'}
                {sidebarTab === 'notes' && 'Meeting Notebook'}
                {sidebarTab === 'chat' && 'In-Room Chat'}
                {sidebarTab === 'participants' && `Participants (${participants.length})`}
                {sidebarTab === 'transcript' && 'Live Captions & Accents'}
                {sidebarTab === 'dossier' && 'Candidate Dossier'}
              </span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setIsSidebarOpen(false)}
                className="h-8 w-8 p-0 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 rounded-lg"
                title="Close Sidebar (Esc)"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Tab Navigation Row */}
            <div className="flex items-center border-b border-slate-200 dark:border-slate-800 p-1.5 gap-1 bg-slate-50/50 dark:bg-slate-950/30 overflow-x-auto shrink-0">
              <button
                type="button"
                onClick={() => setSidebarTab('agenda')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                  sidebarTab === 'agenda'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <CheckSquare className="h-3.5 w-3.5 text-indigo-500" />
                <span>Agenda</span>
              </button>

              <button
                type="button"
                onClick={() => setSidebarTab('notes')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                  sidebarTab === 'notes'
                    ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
                title="Personal and Shared Meeting Notebook"
              >
                <BookOpen className="h-3.5 w-3.5 text-indigo-500" />
                <span>Notes</span>
              </button>

              <button
                type="button"
                onClick={() => setSidebarTab('chat')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                  sidebarTab === 'chat'
                    ? 'bg-white dark:bg-slate-800 text-primary dark:text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <MessageSquare className="h-3.5 w-3.5" />
                <span>Chat</span>
              </button>

              <button
                type="button"
                onClick={() => setSidebarTab('participants')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                  sidebarTab === 'participants'
                    ? 'bg-white dark:bg-slate-800 text-primary dark:text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span>People</span>
              </button>

              <button
                type="button"
                onClick={() => setSidebarTab('transcript')}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                  sidebarTab === 'transcript'
                    ? 'bg-white dark:bg-slate-800 text-primary dark:text-white shadow-sm font-bold'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Captions</span>
              </button>

              {/* In-Meeting Candidate Dossier & Scorecard (Restricted to logged-in Employees) */}
              {!!user && (meeting?.template_type === 'interview' || meeting?.candidate_summary?.candidate_id) && (
                <button
                  type="button"
                  onClick={() => setSidebarTab('dossier')}
                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                    sidebarTab === 'dossier'
                      ? 'bg-amber-500 text-white shadow-sm font-bold'
                      : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40'
                  }`}
                  title="Confidential Candidate Interview Dossier & Scorecard"
                >
                  <Briefcase className="h-3.5 w-3.5" />
                  <span>Dossier</span>
                </button>
              )}
            </div>

            {/* Tab 0: Live Meeting Agenda & Tracker */}
            {sidebarTab === 'agenda' && (
              <div className="flex-1 flex flex-col justify-between overflow-hidden p-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5">
                    <CheckSquare className="h-4 w-4" />
                    Live Agenda Checklist
                  </span>
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/40 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-900/50">
                    {agendaItems.filter((i) => i.is_completed).length} of {agendaItems.length} Done
                  </span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 py-1">
                  {agendaItems.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs space-y-2">
                      <CheckSquare className="h-8 w-8 mx-auto opacity-30 text-slate-400" />
                      <p>No agenda defined for this meeting.</p>
                      <p className="text-[11px] text-slate-500">Add key discussion points below to track progress in real time.</p>
                    </div>
                  ) : (
                    agendaItems.map((item) => (
                      <div
                        key={item.id}
                        onClick={() => handleToggleAgendaItem(item.id, item.is_completed)}
                        className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex items-start gap-3 select-none ${
                          item.is_completed
                            ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-slate-700 dark:text-slate-300'
                            : 'bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800 hover:border-primary/40 text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        <div className="mt-0.5 shrink-0">
                          {item.is_completed ? (
                            <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/40 rounded p-0.5" />
                          ) : (
                            <div className="h-4 w-4 rounded border-2 border-slate-300 dark:border-slate-600 hover:border-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-semibold leading-relaxed ${item.is_completed ? 'line-through text-slate-400 dark:text-slate-500' : ''}`}>
                            {item.text}
                          </p>
                          {item.completed_at && (
                            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono mt-0.5">
                              Completed at {item.completed_at}
                            </p>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Topic Input */}
                <form onSubmit={handleAddAgendaItem} className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <Input
                    placeholder="Add new agenda bullet point..."
                    value={newAgendaInput}
                    onChange={(e) => setNewAgendaInput(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs"
                  />
                  <Button type="submit" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs shrink-0 font-semibold gap-1">
                    <Plus className="h-3.5 w-3.5" /> Add
                  </Button>
                </form>
              </div>
            )}

            {/* Tab: In-Meeting Attendee Notebook & Org Docs Exporter */}
            {sidebarTab === 'notes' && (
              <div className="flex-1 flex flex-col justify-between overflow-hidden p-4">
                {/* Notebook Header */}
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-2">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-4 w-4 text-indigo-500" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
                      Notebook
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleDownloadNotes}
                      className="text-[11px] font-semibold text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1 transition-colors"
                      title="Download meeting notes as Markdown file"
                    >
                      <Download className="h-3 w-3" />
                      <span>Download</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNotesToDocs}
                      disabled={isSavingNotesToDocs}
                      className="text-[11px] font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 px-2.5 py-1 rounded-lg shadow-sm flex items-center gap-1 transition-all"
                      title="Save meeting notes directly into Organization Documents & Knowledge Base"
                    >
                      <Save className="h-3 w-3" />
                      <span>{isSavingNotesToDocs ? 'Saving...' : 'Save to Docs'}</span>
                    </button>
                  </div>
                </div>

                {notesSaveSuccess && (
                  <div className="mb-2 p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5 animate-in fade-in">
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span>{notesSaveSuccess}</span>
                  </div>
                )}

                {/* Quick Insert Snippet Buttons */}
                <div className="flex items-center gap-1.5 pb-2 overflow-x-auto no-scrollbar shrink-0">
                  <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">Insert:</span>
                  <button
                    type="button"
                    onClick={() => handleInsertTemplate('### Key Decisions\n- ')}
                    className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 px-2 py-0.5 rounded-full border border-indigo-200 dark:border-indigo-800 shrink-0"
                  >
                    + Decisions
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTemplate('### Action Items\n- [ ] ')}
                    className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 hover:bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800 shrink-0"
                  >
                    + Action Items
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTemplate('### Candidate Assessment\n- Technical Competence: \n- Problem Solving: \n- Communication: \n- Recommendation: Hire / Next Round\n')}
                    className="text-[10px] font-semibold text-amber-600 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 hover:bg-amber-100 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800 shrink-0"
                  >
                    + Candidate Eval
                  </button>
                  <button
                    type="button"
                    onClick={() => handleInsertTemplate('### Meeting Summary\n')}
                    className="text-[10px] font-semibold text-purple-600 dark:text-purple-300 bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800 shrink-0"
                  >
                    + Summary
                  </button>
                </div>

                {/* Notes Textarea with Auto-Save */}
                <div className="flex-1 flex flex-col min-h-0 pt-1">
                  <textarea
                    value={meetingNotes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    placeholder="Type live meeting notes, minutes, or candidate feedback here... Notes automatically save in your browser."
                    className="w-full flex-1 min-h-[220px] p-3 rounded-xl bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none leading-relaxed"
                  />
                  <div className="flex items-center justify-between pt-2 text-[10px] text-slate-400">
                    <span>Auto-saved locally</span>
                    <span>{meetingNotes.length} characters</span>
                  </div>
                </div>
              </div>
            )}

            {/* Tab 1: In-Room Live Chat */}
            {sidebarTab === 'chat' && (
              <div className="flex-1 flex flex-col justify-between overflow-hidden p-4">
                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                  {messages.length === 0 ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40 text-slate-300" />
                      <p>Send a message to everyone in the meeting room.</p>
                    </div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex flex-col text-xs ${m.isSelf ? 'items-end' : 'items-start'}`}
                      >
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                          <span className="font-semibold text-slate-700 dark:text-slate-300">{m.senderName}</span>
                          <span>&bull;</span>
                          <span>{m.timestamp}</span>
                        </div>
                        <div
                          className={`p-2.5 rounded-2xl max-w-[85%] leading-relaxed ${
                            m.isSelf
                              ? 'bg-primary text-primary-foreground font-medium rounded-tr-sm'
                              : 'bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-sm border border-slate-200 dark:border-slate-700'
                          }`}
                        >
                          {m.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="mt-3 flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <Input
                    placeholder="Type a message..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs"
                  />
                  <Button type="submit" size="icon" className="h-9 w-9 bg-primary text-primary-foreground hover:bg-primary/90 shrink-0">
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            )}

            {/* Tab 2: Participants List */}
            {sidebarTab === 'participants' && (
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">Roster ({participants.length})</span>
                    {raisedHands.length > 0 && isHost && (
                      <button
                        type="button"
                        onClick={handleLowerAllHands}
                        className="text-[10px] text-amber-500 hover:text-amber-600 font-bold underline"
                      >
                        Lower All
                      </button>
                    )}
                  </div>
                  <Button
                    onClick={() => setIsInviteOpen(true)}
                    size="sm"
                    variant="ghost"
                    className="text-xs text-primary hover:text-primary/80 p-0 h-auto font-semibold"
                  >
                    + Add People
                  </Button>
                </div>

                {participants.map((p) => {
                  const pHandIdx = raisedHands.findIndex((h) => h.email?.toLowerCase() === p.email?.toLowerCase());
                  const isHandUp = pHandIdx !== -1;
                  const isParticipantSpeaking = activeSpeakerEmail?.toLowerCase() === p.email?.toLowerCase();

                  return (
                    <div
                      key={p.id || p.email}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-all ${
                        isHandUp
                          ? 'bg-amber-500/10 border-amber-500/30'
                          : 'bg-slate-50 dark:bg-slate-950/50 border-slate-200 dark:border-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-slate-200 dark:bg-slate-800 text-primary font-bold flex items-center justify-center shrink-0 text-[11px] relative">
                          {p.name?.[0] || p.email[0].toUpperCase()}
                          {isHandUp && (
                            <span className="absolute -top-1 -right-1 text-[10px] leading-none">✋</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 dark:text-slate-200 truncate flex items-center gap-1.5">
                            {p.name}
                            {p.role === 'host' && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-primary/10 text-primary font-bold">
                                Host
                              </span>
                            )}
                            {isHandUp && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-500 font-bold border border-amber-500/30">
                                #{pHandIdx + 1} in queue
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-400 truncate">{p.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isHost && isHandUp && (
                          <button
                            type="button"
                            onClick={() => handleToggleHand('lower', p.email)}
                            className="text-[10px] text-slate-400 hover:text-amber-500 font-medium underline"
                            title="Lower participant hand"
                          >
                            Lower
                          </button>
                        )}
                        {isParticipantSpeaking ? (
                          <Volume2 className="h-3.5 w-3.5 text-emerald-500 animate-pulse" />
                        ) : (
                          <Mic className="h-3.5 w-3.5 text-slate-400" />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Tab 3: Live Transcript Log */}
            {sidebarTab === 'transcript' && (
              <div className="flex-1 flex flex-col overflow-hidden p-4">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Live Speech Log
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400">Accent:</span>
                    <select
                      value={speechLanguage}
                      onChange={(e) => handleSelectSpeechLanguage(e.target.value)}
                      className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[10px] font-semibold rounded-lg px-2 py-1 border border-slate-200 dark:border-slate-700 focus:outline-none cursor-pointer"
                    >
                      <option value="en-IN">English (India)</option>
                      <option value="en-US">English (US)</option>
                      <option value="en-GB">English (UK)</option>
                      <option value="hi-IN">Hindi (India)</option>
                    </select>
                  </div>
                </div>

                {/* Sub-second live interim preview box */}
                {currentSpeechCaption && (
                  <div className="p-3 mb-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-xs space-y-1 animate-pulse">
                    <div className="flex items-center justify-between text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">
                      <span className="flex items-center gap-1">
                        <Radio className="h-3 w-3 animate-ping text-indigo-500" />
                        Transcribing Dialogue...
                      </span>
                      <span className="font-mono text-slate-400 text-[9px]">Sub-second</span>
                    </div>
                    <p className="text-indigo-900 dark:text-indigo-200 italic font-medium leading-relaxed">
                      "{currentSpeechCaption}"
                    </p>
                  </div>
                )}

                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                  {liveTranscript.length === 0 && !currentSpeechCaption ? (
                    <div className="text-center py-12 text-slate-400 text-xs">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-40 text-slate-300" />
                      <p>Start speaking to see real-time dialogue transcription here.</p>
                      <p className="text-[11px] text-slate-500 mt-1">Select your dialect above for maximum accuracy.</p>
                    </div>
                  ) : (
                    liveTranscript.map((t, i) => (
                      <div key={i} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 text-xs space-y-1">
                        <div className="flex items-center justify-between text-[10px] text-primary font-semibold">
                          <span>{t.speaker_name}</span>
                          <span className="text-slate-400 font-normal">{t.timestamp}</span>
                        </div>
                        <p className="text-slate-700 dark:text-slate-300 leading-relaxed font-medium">{t.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Tab 4: In-Meeting Candidate Dossier & Live Scorecard (Feature 1) */}
            {sidebarTab === 'dossier' && (
              <CandidateInterviewDossier
                roomCode={roomCode!}
                isHost={isHost}
                userEmail={user?.email}
                onClose={() => setSidebarTab('agenda')}
              />
            )}
          </aside>
        )}

        {/* Floating Quick Re-open Pill when Sidebar is closed */}
        {!isSidebarOpen && (
          <button
            type="button"
            onClick={() => setIsSidebarOpen(true)}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-30 bg-slate-900/90 hover:bg-slate-800 border-l border-y border-slate-700 text-slate-200 px-2 py-3.5 rounded-l-2xl shadow-2xl flex flex-col items-center gap-1.5 transition-all group hover:px-2.5 backdrop-blur-md cursor-pointer"
            title="Open Meeting Panel (Chat, Agenda, People)"
          >
            <ChevronLeft className="h-4 w-4 text-indigo-400 group-hover:-translate-x-0.5 transition-transform" />
            <MessageSquare className="h-3.5 w-3.5 text-slate-400 group-hover:text-white" />
            <span className="text-[10px] font-bold uppercase tracking-wider [writing-mode:vertical-rl] text-slate-400 group-hover:text-white">
              Panel
            </span>
            {messages.length > 0 && (
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </button>
        )}
      </div>

      {/* Floating Real-Time Speech While Muted Warning Banner */}
      {isTalkingWhileMuted && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-3 duration-200 pointer-events-auto">
          <div className="flex items-center gap-2.5 px-4 py-2.5 rounded-2xl bg-amber-500 text-slate-950 font-bold text-xs shadow-2xl border border-amber-400">
            <MicOff className="h-4 w-4 shrink-0 text-slate-950 animate-bounce" />
            <span>You are speaking while muted.</span>
            <button
              type="button"
              onClick={toggleAudio}
              className="ml-1 px-2.5 py-1 rounded-xl bg-slate-950 text-amber-400 text-[11px] font-bold hover:bg-slate-900 transition-colors shadow-sm"
            >
              Click to Unmute
            </button>
            <span className="text-[10px] text-slate-900/80 font-medium hidden sm:inline">
              (or hold Spacebar)
            </span>
          </div>
        </div>
      )}

      {/* Floating Push-to-Talk Active HUD Badge */}
      {isPushToTalkActive && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 animate-in fade-in zoom-in-95 duration-100 pointer-events-none">
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-emerald-500 text-white font-bold text-xs shadow-2xl border border-emerald-400">
            <Mic className="h-4 w-4 animate-pulse" />
            <span>Push-to-Talk Active (Spacebar Held)</span>
          </div>
        </div>
      )}

      {/* Bottom Meeting Controls Dock */}
      <footer className="h-16 sm:h-18 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between px-3 sm:px-6 shadow-sm shrink-0 gap-2 overflow-x-auto no-scrollbar">
        {/* Left Side: Meeting Room Info & Live Status */}
        <div className="hidden 2xl:flex items-center gap-2.5 text-xs text-slate-600 dark:text-slate-400 font-medium shrink-0">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[150px]">
            {meeting?.title || 'CORE Meeting'}
          </span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700">
            {meeting?.room_code || roomCode}
          </span>
        </div>

        {/* Center: Stage, Media & Engagement Controls (Single row, NO wrap) */}
        <div className="flex items-center gap-2 sm:gap-2.5 mx-auto shrink-0 flex-nowrap">
          {/* Cluster 1: Stage Workspace Pill [Video | Code | Whiteboard | Framework] */}
          <div className="flex items-center p-0.5 sm:p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 gap-0.5 sm:gap-1 shadow-inner shrink-0">
            <button
              type="button"
              onClick={() => setStageMode('video')}
              className={`h-8 sm:h-9 px-2 sm:px-2.5 rounded-lg sm:rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                stageMode === 'video'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Video Stage"
            >
              <VideoIcon className="h-3.5 w-3.5 text-indigo-500" />
              <span className="hidden sm:inline">Video</span>
            </button>

            {stageMode === 'video' && (
              <button
                type="button"
                onClick={() => setLayoutMode(layoutMode === 'grid' ? 'speaker' : 'grid')}
                className="h-8 sm:h-9 px-1.5 sm:px-2 rounded-lg sm:rounded-xl text-xs font-semibold flex items-center gap-1 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-all"
                title={layoutMode === 'grid' ? 'Switch to Spotlight View' : 'Switch to Grid View'}
              >
                {layoutMode === 'grid' ? <LayoutGrid className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
                <span className="text-[11px] hidden lg:inline">{layoutMode === 'grid' ? 'Grid' : 'Spotlight'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setStageMode('code')}
              className={`h-8 sm:h-9 px-2 sm:px-2.5 rounded-lg sm:rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                stageMode === 'code'
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Pair Programming Code Sandbox"
            >
              <Code2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Code</span>
            </button>

            <button
              type="button"
              onClick={() => setStageMode('whiteboard')}
              className={`h-8 sm:h-9 px-2 sm:px-2.5 rounded-lg sm:rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                stageMode === 'whiteboard'
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Collaborative Whiteboard Canvas"
            >
              <Palette className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Whiteboard</span>
            </button>

            <button
              type="button"
              onClick={() => setStageMode('framework')}
              className={`h-8 sm:h-9 px-2 sm:px-2.5 rounded-lg sm:rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                stageMode === 'framework'
                  ? 'bg-indigo-600 text-white shadow-sm font-bold'
                  : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
              title="Structured Framework (Retro, 1-on-1, Standup)"
            >
              <Kanban className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Framework</span>
            </button>
          </div>

          {/* Cluster 2: Media Controls Pill */}
          <div className="flex items-center p-0.5 sm:p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 gap-0.5 sm:gap-1 shadow-inner shrink-0">
            {/* Mic */}
            <Button
              type="button"
              onClick={toggleAudio}
              variant="ghost"
              className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl p-0 transition-all ${
                isAudioMuted || !localStream
                  ? 'bg-rose-500 text-white hover:bg-rose-600'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
              }`}
              title={isAudioMuted || !localStream ? 'Unmute Mic' : 'Mute Mic'}
            >
              {isAudioMuted || !localStream ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>

            {/* Video */}
            <Button
              type="button"
              onClick={toggleVideo}
              variant="ghost"
              className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl p-0 transition-all ${
                !isLocalVideoActive
                  ? 'bg-rose-500 text-white hover:bg-rose-600'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
              }`}
              title={!isLocalVideoActive ? 'Start Video' : 'Stop Video'}
            >
              {!isLocalVideoActive ? <VideoOff className="h-4 w-4" /> : <VideoIcon className="h-4 w-4" />}
            </Button>

            {/* Screen Share */}
            <Button
              type="button"
              onClick={toggleScreenShare}
              variant="ghost"
              className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl p-0 transition-all ${
                isScreenSharing
                  ? 'bg-primary text-primary-foreground'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
              }`}
              title={isScreenSharing ? 'Stop Screen Share' : 'Share Screen'}
            >
              {isScreenSharing ? <MonitorOff className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
            </Button>

            {/* Present Document */}
            <Button
              type="button"
              onClick={() => setIsDocModalOpen(true)}
              variant="ghost"
              className={`h-8 sm:h-9 px-2 rounded-lg sm:rounded-xl transition-all gap-1 text-xs font-semibold ${
                presentationDoc
                  ? 'bg-primary/20 text-primary font-bold'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
              }`}
              title="Present Document or PDF"
            >
              <Presentation className="h-3.5 w-3.5 text-indigo-500" />
              <span className="hidden xl:inline">{presentationDoc ? 'Presenting' : 'Doc'}</span>
            </Button>

            {/* Record */}
            <Button
              type="button"
              onClick={() => {
                if (isRecording) {
                  handleStopRecording();
                } else {
                  setIsRecordModalOpen(true);
                }
              }}
              variant="ghost"
              className={`h-8 sm:h-9 px-2 rounded-lg sm:rounded-xl transition-all gap-1 text-xs font-semibold ${
                isRecording
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
              }`}
              title={isRecording ? 'Stop Recording' : 'Record'}
            >
              <Disc className={`h-3.5 w-3.5 ${isRecording ? 'animate-spin text-white' : 'text-rose-500'}`} />
              <span className="hidden xl:inline">
                {isRecording
                  ? `REC ${Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:${(recordingSeconds % 60).toString().padStart(2, '0')}`
                  : 'Record'}
              </span>
            </Button>
          </div>

          {/* Cluster 3: Social & Interaction Pill */}
          <div className="flex items-center p-0.5 sm:p-1 bg-slate-100 dark:bg-slate-950/80 rounded-xl sm:rounded-2xl border border-slate-200 dark:border-slate-800 gap-0.5 sm:gap-1 shadow-inner shrink-0">
            {/* Raise Hand */}
            <Button
              type="button"
              onClick={() => handleToggleHand('toggle')}
              variant="ghost"
              className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl p-0 transition-all ${
                isMyHandRaised
                  ? 'bg-amber-500 text-white animate-pulse'
                  : 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
              }`}
              title={isMyHandRaised ? 'Lower Hand' : 'Raise Hand'}
            >
              <Hand className="h-4 w-4" />
            </Button>

            {/* Reactions Picker */}
            <div className="relative">
              <Button
                type="button"
                onClick={() => setIsReactionPickerOpen(!isReactionPickerOpen)}
                variant="ghost"
                className={`h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl p-0 transition-all ${
                  isReactionPickerOpen
                    ? 'bg-amber-500/20 text-amber-500'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800'
                }`}
                title="React with Emoji"
              >
                <Smile className="h-4 w-4 text-amber-500" />
              </Button>

              {isReactionPickerOpen && (
                <div className="absolute bottom-12 left-1/2 -translate-x-1/2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-2xl shadow-2xl flex items-center gap-1.5 z-40 animate-in fade-in zoom-in-95 duration-150">
                  {['👍', '👏', '❤️', '🎉', '😂', '🔥', '🚀', '💡'].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => handleSendReaction(emoji)}
                      className="h-8 w-8 flex items-center justify-center text-base hover:scale-125 transition-transform rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                      title={`React ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Side: Panel Toggle & End Meeting Action (ALWAYS visible, single row, NEVER wraps) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Audio & Video Device Settings */}
          <Button
            type="button"
            onClick={() => setIsDeviceSettingsOpen(true)}
            variant="ghost"
            className="h-8 sm:h-9 w-8 sm:w-9 rounded-xl p-0 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all shrink-0"
            title="Audio & Video Device Settings"
          >
            <Settings className="h-4 w-4" />
          </Button>

          {/* Sidebar Toggle Button */}
          <Button
            type="button"
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            variant="outline"
            className={`h-8 sm:h-9 px-2.5 sm:px-3 rounded-xl border transition-all gap-1.5 text-xs font-semibold ${
              isSidebarOpen
                ? 'bg-primary text-primary-foreground border-primary shadow-sm font-bold'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-white hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
            title="Toggle Sidebar Panel"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="inline">{isSidebarOpen ? 'Panel' : 'Open Panel'}</span>
            {messages.length > 0 && !isSidebarOpen && (
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            )}
          </Button>

          {/* End Call / Leave Room */}
          {isHost ? (
            <Button
              onClick={() => setIsEndModalOpen(true)}
              className="bg-rose-600 hover:bg-rose-700 text-white font-semibold h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-xl shadow-sm gap-1 text-xs shrink-0"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">End Meeting</span>
              <span className="sm:hidden">End</span>
            </Button>
          ) : (
            <Button
              onClick={() => setIsLeaveModalOpen(true)}
              className="bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 border border-rose-200 dark:border-rose-900/50 font-semibold h-8 sm:h-9 px-2.5 sm:px-3.5 rounded-xl gap-1 text-xs shrink-0"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Leave Room</span>
              <span className="sm:hidden">Leave</span>
            </Button>
          )}
        </div>
      </footer>

      {/* End Meeting Confirmation Modal */}
      <DeleteConfirmModal
        open={isEndModalOpen}
        onOpenChange={setIsEndModalOpen}
        title="End Meeting for Everyone"
        description="Are you sure you want to end this meeting for all participants? Spoken dialogue will be analyzed with Google Gemini to generate meeting summaries, key decisions, and action items."
        confirmLabel="End Meeting"
        onConfirm={executeEndMeeting}
        isLoading={isEnding}
      />

      {/* Leave Meeting Confirmation Modal */}
      <DeleteConfirmModal
        open={isLeaveModalOpen}
        onOpenChange={setIsLeaveModalOpen}
        title="Leave Meeting"
        description="Are you sure you want to leave this video conference room?"
        confirmLabel="Leave Room"
        onConfirm={executeLeaveMeeting}
      />

      {/* Passcode Prompt Modal */}
      <Dialog open={isPasscodeModalOpen} onOpenChange={setIsPasscodeModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Lock className="h-5 w-5 text-amber-500" />
              Passcode Protected Conference
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              This meeting room requires a security passcode to enter.
            </p>
            {joinError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 rounded-xl text-xs font-semibold">
                {joinError}
              </div>
            )}
            <Input
              type="password"
              placeholder="Enter meeting passcode..."
              value={enteredPasscode}
              onChange={(e) => setEnteredPasscode(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => navigate('/meetings')} className="text-xs font-semibold">
              Cancel
            </Button>
            <Button onClick={() => handleJoinMeeting(enteredPasscode)} className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold">
              Enter Room
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mid-Meeting Invite Modal */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Plus className="h-5 w-5 text-primary" />
              Invite Colleague to Meeting
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Enter colleague's email. An email with direct join link and calendar invite (.ics) will be dispatched immediately.
            </p>
            {inviteSuccess && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 rounded-xl text-xs font-semibold flex items-center gap-2">
                <Check className="h-4 w-4" />
                {inviteSuccess}
              </div>
            )}
            <Input
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmailInput}
              onChange={(e) => setInviteEmailInput(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-sm"
            />
          </div>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsInviteOpen(false)} className="text-xs font-semibold">
              Close
            </Button>
            <Button onClick={handleSendInvite} className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold text-xs">
              Send Email Invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Present CORE Document / PDF Dialog Modal */}
      <Dialog open={isDocModalOpen} onOpenChange={setIsDocModalOpen}>
        <DialogContent className="sm:max-w-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Presentation className="h-5 w-5 text-primary" />
              Present CORE Document or PDF
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Synchronize document presentation directly on the room stage for all attendees in real-time.
            </p>

            {/* Document Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
              <Input
                placeholder="Search Knowledge Base articles & documents..."
                value={docSearchQuery}
                onChange={(e) => setDocSearchQuery(e.target.value)}
                className="pl-8 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800 text-xs"
              />
            </div>

            {/* List of Documents */}
            <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-800 rounded-xl p-2 bg-slate-50/50 dark:bg-slate-950/40">
              {isKbDocsLoading ? (
                <div className="text-center py-6 text-xs text-slate-400">Loading documents...</div>
              ) : kbDocuments.filter((d: any) => (d.title || d.file_name || '').toLowerCase().includes(docSearchQuery.toLowerCase())).length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">No documents found matching query.</div>
              ) : (
                kbDocuments
                  .filter((d: any) => (d.title || d.file_name || '').toLowerCase().includes(docSearchQuery.toLowerCase()))
                  .map((doc: any) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs hover:border-primary/40 transition-colors"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">{doc.title || doc.file_name}</p>
                          <p className="text-[10px] text-slate-400">{doc.category || doc.file_type || 'CORE Document'}</p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        onClick={() => handleStartPresentingDoc(doc)}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold h-7 px-3 shrink-0"
                      >
                        Present
                      </Button>
                    </div>
                  ))
              )}
            </div>

            {/* Upload Local PDF / Slide Deck Option */}
            <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                Or Upload Local PDF / Markdown Deck:
              </label>
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-4 hover:border-primary/50 cursor-pointer bg-slate-50 dark:bg-slate-950/50 transition-colors">
                <FileUp className="h-6 w-6 text-primary mb-1.5" />
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">Choose PDF or text file to present</span>
                <span className="text-[10px] text-slate-400 mt-0.5">Supports .pdf, .txt, .md files</span>
                <input
                  type="file"
                  accept=".pdf,.txt,.md"
                  onChange={handleUploadAndPresentLocalDoc}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsDocModalOpen(false)} className="text-xs font-semibold">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Choose Recording Type Dialog Modal */}
      <Dialog open={isRecordModalOpen} onOpenChange={setIsRecordModalOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white">
              <Disc className="h-5 w-5 text-rose-500" />
              Choose Recording Mode
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select how you would like to record this meeting session. The recording will be saved locally and uploaded to the meeting records automatically.
            </p>

            {/* Option 1: Full Video & Screen Recording */}
            <div
              onClick={() => handleStartRecording('video')}
              className="group p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-primary/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-all flex items-start gap-3.5 select-none"
            >
              <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0 group-hover:scale-105 transition-transform">
                <MonitorUp className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-primary transition-colors">
                    Full Video Meeting (Screen & Voice)
                  </h4>
                  <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">HD Video</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Records shared screen, presentation slides, camera previews, and meeting voice discussion.
                </p>
              </div>
            </div>

            {/* Option 2: Audio-Only Voice Minutes */}
            <div
              onClick={() => handleStartRecording('audio')}
              className="group p-4 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-500/60 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer transition-all flex items-start gap-3.5 select-none"
            >
              <div className="h-10 w-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 shrink-0 group-hover:scale-105 transition-transform">
                <Mic className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-emerald-500 transition-colors">
                    Audio-Only Meeting (Voice Minutes)
                  </h4>
                  <span className="text-[10px] font-semibold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full">Voice Only</span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                  Records pure high-fidelity voice audio directly from attendees. No screen sharing permission needed. Lightweight and fast.
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setIsRecordModalOpen(false)} className="text-xs font-semibold">
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audio & Video Device Settings Modal */}
      <Dialog open={isDeviceSettingsOpen} onOpenChange={setIsDeviceSettingsOpen}>
        <DialogContent className="sm:max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white rounded-2xl p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900 dark:text-white text-base">
              <Settings className="h-5 w-5 text-indigo-500" />
              Audio & Video Settings
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select your preferred microphone, camera, and speaker devices. Settings are saved automatically for future calls.
            </p>

            {/* Microphone Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Mic className="h-3.5 w-3.5 text-indigo-500" />
                Microphone Input
              </label>
              <select
                value={selectedMicId}
                onChange={(e) => switchDevice('audio', e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {audioInputDevices.length === 0 ? (
                  <option value="">Default Microphone</option>
                ) : (
                  audioInputDevices.map((d, idx) => (
                    <option key={d.deviceId || idx} value={d.deviceId}>
                      {d.label || `Microphone ${idx + 1}`}
                    </option>
                  ))
                )}
              </select>
              <div className="flex items-center gap-2 pt-1 text-[11px] text-slate-500">
                <span className={`h-2 w-2 rounded-full ${isLocalSpeaking ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                <span>{isLocalSpeaking ? 'Speaking detected' : 'Mic ready'}</span>
              </div>
            </div>

            {/* Camera Selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <Camera className="h-3.5 w-3.5 text-indigo-500" />
                Camera Video Source
              </label>
              <select
                value={selectedCamId}
                onChange={(e) => switchDevice('video', e.target.value)}
                className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {videoInputDevices.length === 0 ? (
                  <option value="">Default Camera</option>
                ) : (
                  videoInputDevices.map((d, idx) => (
                    <option key={d.deviceId || idx} value={d.deviceId}>
                      {d.label || `Camera ${idx + 1}`}
                    </option>
                  ))
                )}
              </select>
            </div>

            {/* Speaker Selector (if supported by browser) */}
            {audioOutputDevices.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                  <Headphones className="h-3.5 w-3.5 text-indigo-500" />
                  Speaker Audio Output
                </label>
                <select
                  value={selectedSpeakerId}
                  onChange={(e) => switchDevice('speaker', e.target.value)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {audioOutputDevices.map((d, idx) => (
                    <option key={d.deviceId || idx} value={d.deviceId}>
                      {d.label || `Speaker ${idx + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <DialogFooter className="flex justify-between items-center sm:justify-between pt-2">
            <button
              type="button"
              onClick={refreshMediaDevices}
              className="text-xs text-indigo-500 hover:text-indigo-400 font-semibold"
            >
              Refresh Device List
            </button>
            <Button
              onClick={() => setIsDeviceSettingsOpen(false)}
              className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-4 rounded-xl"
            >
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
