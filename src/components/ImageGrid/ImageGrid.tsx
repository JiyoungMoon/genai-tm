import React from 'react';
import style from './style.module.css';
import Sample, { SampleState } from './Sample';
import { Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface Props {
    samples: SampleState[];
    disabled?: boolean;
    onDelete: (index: number) => void;
}

export default function ImageGrid({ samples, onDelete, disabled }: Props) {
    const { t } = useTranslation();
    return (
        <div className={style.scroller}>
            <div className={samples.length === 0 ? style.sampleListEmpty : style.sampleList}>
                {samples.map((s, ix) => (
                    <Sample
                        key={s.id}
                        image={s.data}
                        index={ix}
                        onDelete={onDelete}
                        status={s.state}
                        disabled={disabled}
                    />
                ))}
                {samples.length === 0 && (
                    <Alert
                        style={{ border: '1px solid #0288d1' }}
                        severity="info"
                    >
                        {t('collect.samplePrompt')}
                    </Alert>
                )}
            </div>
        </div>
    );
}
