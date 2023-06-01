import JSZip from 'jszip';
import { useEffect } from 'react';
import * as tf from '@tensorflow/tfjs';
import { BehaviourType } from '../Behaviour/Behaviour';
import { IClassification, behaviourState, classState, fileData, sessionCode } from '../../state';
import { TeachableModel, useModelLoader, Metadata } from '../../util/TeachableModel';
import { useRecoilState, useSetRecoilState } from 'recoil';

interface ProjectTemp {
    modelJson?: string;
    modelWeights?: ArrayBuffer;
    metadata?: string;
    behaviours?: string;
    samples: string[][];
}

interface Project {
    id?: string;
    metadata?: Metadata;
    model?: tf.io.ModelJSON;
    weights?: ArrayBuffer;
    behaviours?: BehaviourType[];
    samples?: IClassification[];
}

export async function loadProject(file: File | Blob): Promise<Project> {
    const project: ProjectTemp = {
        samples: [],
    };

    const zip = await JSZip.loadAsync(file);
    const promises: Promise<void>[] = [];

    zip.forEach((path: string, data: JSZip.JSZipObject) => {
        if (data.name === 'model.json') {
            promises.push(
                data.async('string').then((r) => {
                    project.modelJson = r;
                })
            );
        } else if (data.name === 'weights.bin') {
            promises.push(
                data.async('arraybuffer').then((r) => {
                    project.modelWeights = r;
                })
            );
        } else if (data.name === 'behaviours.json') {
            promises.push(
                data.async('string').then((r) => {
                    project.behaviours = r;
                })
            );
        } else if (data.name === 'metadata.json') {
            promises.push(
                data.async('string').then((r) => {
                    project.metadata = r;
                })
            );
        } else {
            const parts = data.name.split('/');
            if (parts.length === 2 && !!parts[1] && parts[0] === 'samples') {
                const split1 = parts[1].split('.');
                if (split1.length === 2) {
                    const split2 = split1[0].split('_');
                    if (split2.length === 2) {
                        const ix1 = parseInt(split2[0]);
                        const ix2 = parseInt(split2[1]);
                        while (project.samples.length <= ix1) project.samples.push([]);
                        while (project.samples[ix1].length <= ix2) project.samples[ix1].push('');
                        promises.push(
                            data.async('base64').then((r) => {
                                project.samples[ix1][ix2] = `data:image/png;base64,${r}`;
                            })
                        );
                    }
                }
            }
        }
    });

    await Promise.all(promises);

    if (project.metadata && project.modelJson && project.modelWeights) {
        const meta = JSON.parse(project.metadata);

        const parsedModel = JSON.parse(project.modelJson) as tf.io.ModelJSON;

        const model = new TeachableModel('image', meta, parsedModel, project.modelWeights);
        await model.ready();

        let samplePromises: Promise<HTMLCanvasElement>[] = [];

        for (const item of project.samples) {
            for (const s of item) {
                samplePromises.push(
                    new Promise((resolve) => {
                        const canvas = document.createElement('canvas');
                        canvas.width = 224;
                        canvas.height = 224;
                        canvas.style.width = '58px';
                        canvas.style.height = '58px';
                        const ctx = canvas.getContext('2d');
                        const img = new Image();
                        img.onload = (ev: Event) => {
                            ctx?.drawImage(img, 0, 0);
                            resolve(canvas);
                        };
                        img.src = s;
                    })
                );
            }
        }

        const canvases = await Promise.all(samplePromises);

        const samples: IClassification[] = [];

        let base = 0;
        for (let i = 0; i < project.samples.length; ++i) {
            const newImage: HTMLCanvasElement[] = [];
            for (let j = 0; j < project.samples[i].length; ++j) {
                newImage.push(canvases[base++]);
            }
            samples.push({
                label: model.getLabel(i),
                samples: newImage,
            });
        }

        return {
            id: meta.projectId,
            model: parsedModel,
            metadata: meta,
            weights: project.modelWeights,
            behaviours: project.behaviours ? JSON.parse(project.behaviours).behaviours : [],
            samples: samples.length > 0 ? samples : undefined,
        };
    }

    return {};
}

interface Props {
    onLoaded?: (hadBehaviours: boolean) => void;
    onError?: (err: unknown) => void;
}

export function ModelLoader({ onLoaded, onError }: Props) {
    const [projectFile, setProjectFile] = useRecoilState(fileData);
    const setBehaviours = useSetRecoilState(behaviourState);
    const setCode = useSetRecoilState(sessionCode);
    const setData = useSetRecoilState(classState);
    const loadModel = useModelLoader();

    useEffect(() => {
        if (projectFile) {
            loadProject(projectFile)
                .then((project) => {
                    if (project.id) setCode(project.id);
                    if (project.behaviours) setBehaviours(project.behaviours);
                    if (project.samples) setData(project.samples);

                    if (project.metadata && project.model && project.weights) {
                        loadModel(project.metadata, project.model, project.weights).then((result) => {
                            if (result && onLoaded) {
                                onLoaded(!!project.behaviours);
                            }
                        });
                    }

                    /*if (project.behaviours && !resetOnLoad) {
                        onSkip(1);
                    }*/
                    setProjectFile(null);
                })
                .catch((e) => {
                    if (onError) onError(e);
                    setProjectFile(null);
                });
        }
    }, [projectFile, loadModel, setProjectFile, onLoaded, setData, setCode, setBehaviours, onError]);

    return null;
}
