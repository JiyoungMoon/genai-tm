import { fatalWebcam } from '@genaitm/state';
import { Webcam } from '@knicos/genai-base';
import Skeleton from '@mui/material/Skeleton';
import { useCallback } from 'react';
import { useSetRecoilState } from 'recoil';

interface Props {
    enabled?: boolean;
    enableInput?: boolean;
    doPrediction: (image: HTMLCanvasElement) => Promise<void>;
    doPostProcess?: (image: HTMLCanvasElement) => void;
    size: number;
}

export default function WebcamInput({ size, enabled, enableInput, doPrediction, doPostProcess }: Props) {
    const setFatal = useSetRecoilState(fatalWebcam);
    const doFatal = useCallback(() => setFatal(true), [setFatal]);

    return (
        <>
            {enabled && (
                <Webcam
                    disable={!enableInput}
                    capture={enableInput && enabled}
                    interval={200}
                    direct
                    onCapture={doPrediction}
                    onPostprocess={doPostProcess}
                    size={size}
                    onFatal={doFatal}
                />
            )}
            {!enabled && (
                <Skeleton
                    variant="rounded"
                    width={size}
                    height={size}
                />
            )}
        </>
    );
}
