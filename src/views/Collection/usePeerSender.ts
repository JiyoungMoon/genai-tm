import { useCallback, useRef, useState } from 'react';
import { DataConnection } from 'peerjs';
import { SampleStateValue } from '../../components/ImageGrid/Sample';
import { BuiltinEvent, PeerErrorType, PeerEvent, PeerStatus, usePeer, useRandom } from '@knicos/genai-base';

const POLLING = 5000;

type SampleSender = (img: HTMLCanvasElement, classIndex: number, id: string) => void;
type SampleDelete = (classIndex: number, id: string) => void;

interface SampleFuncs {
    send: SampleSender;
    delete: SampleDelete;
}

interface ReturnObject {
    sender?: SampleSender;
    deleter?: SampleDelete;
    classNames: string[];
    state: PeerStatus;
    ready: boolean;
    error: PeerErrorType;
}

interface ClassEvent extends PeerEvent {
    event: 'class';
    labels: string[];
    samples: string[][];
}

interface SampleStateEvent extends PeerEvent {
    event: 'sample_state';
    id: string;
    state: SampleStateValue;
}

type EventProtocol = BuiltinEvent | ClassEvent | SampleStateEvent;

export function usePeerSender(
    code: string,
    onSampleState: (id: string, state: SampleStateValue) => void,
    onSamplesUpdate?: (samples: Set<string>[]) => void
): ReturnObject {
    const [sampleFuncs, setSampleFuncs] = useState<SampleFuncs | null>(null);
    const [classLabels, setClassLabels] = useState<string[]>([]);
    const pollRef = useRef<number>(-1);
    const pollWaiting = useRef(false);
    const MYCODE = useRandom(8);

    const dataHandler = useCallback(async (data: EventProtocol, conn: DataConnection) => {
        if (data?.event === 'class') {
            pollWaiting.current = false;
            setClassLabels(data.labels);

            const newSampleIDs = data.samples.map((s: string[]) => {
                const newSet = new Set<string>();
                s.forEach((a) => newSet.add(a));
                return newSet;
            });

            if (onSamplesUpdate) onSamplesUpdate(newSampleIDs);
        } else if (data?.event === 'sample_state') {
            onSampleState(data?.id, data?.state);
            conn.send({ event: 'request_class' });
        }
    }, []);

    const openHandler = useCallback((conn: DataConnection) => {
        conn.send({ event: 'request_class' });
        pollRef.current = window.setInterval(() => {
            if (pollWaiting.current) {
                return;
            }
            pollWaiting.current = true;
            conn.send({ event: 'request_class' });
        }, POLLING);
        setSampleFuncs({
            send: (img: HTMLCanvasElement, classIndex: number, id: string) => {
                conn.send({ event: 'add_sample', data: img.toDataURL(), index: classIndex, id });
            },
            delete: (classIndex: number, id: string) => {
                conn.send({ event: 'delete_sample', index: classIndex, id });
            },
        });
    }, []);

    const closeHandler = useCallback(() => {
        if (pollRef.current >= 0) clearInterval(pollRef.current);
        pollWaiting.current = false;
    }, []);

    const { ready, status, error } = usePeer<EventProtocol>({
        host: import.meta.env.VITE_APP_PEER_SERVER,
        secure: import.meta.env.VITE_APP_PEER_SECURE === '1',
        key: import.meta.env.VITE_APP_PEER_KEY || 'peerjs',
        port: import.meta.env.VITE_APP_PEER_PORT ? parseInt(import.meta.env.VITE_APP_PEER_PORT) : 443,
        server: `tm-${code}`,
        code: `tm-${MYCODE}`,
        onData: dataHandler,
        onConnect: openHandler,
        onClose: closeHandler,
    });

    return {
        sender: sampleFuncs ? sampleFuncs.send : undefined,
        deleter: sampleFuncs ? sampleFuncs.delete : undefined,
        classNames: classLabels,
        state: status,
        ready,
        error,
    };
}
