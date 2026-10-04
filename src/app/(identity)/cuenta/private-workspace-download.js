'use client';
import {useEffect,useRef,useState} from 'react';
import {useWorkspaceRequest} from './workspace-request-lifecycle';

export function PrivateWorkspaceDownload({url,getSessionToken,filename='obrasaas-archivo',expectedBytes,expectedContentType,maxBytes,children,disabled,className,onError}) {
  const request = useWorkspaceRequest(getSessionToken);
  const [busy,setBusy] = useState(false), [notice,setNotice] = useState('');
  const alive = useRef(true), objectUrl = useRef(null), timer = useRef(null);
  useEffect(() => { alive.current=true; return () => { alive.current=false; clearTimeout(timer.current); if(objectUrl.current) URL.revokeObjectURL(objectUrl.current); }; }, []);
  async function download() {
    if (busy || disabled) return;
    setBusy(true); setNotice('');
    try {
      const blob = await request(url, {requestTimeoutMs:20000}, async response => {
        if (!response.ok) {
          let body;try { body=await response.json(); } catch { /* HTML denials still carry their HTTP access status. */ }
          throw Object.assign(new Error('No se pudo descargar el archivo con tu acceso actual. Actualizá la obra y volvé a intentar.'),{status:response.status,code:body?.code});
        }
        const value = await response.blob();
        if (!value.size || value.size>maxBytes || expectedBytes!==undefined && value.size!==expectedBytes || typeof expectedContentType!=='string' || value.type.split(';')[0]!==expectedContentType.split(';')[0]) throw new Error('El archivo no coincide con la versión solicitada. Actualizá la obra.');
        return value;
      });
      if (!alive.current) return;
      clearTimeout(timer.current); if(objectUrl.current) URL.revokeObjectURL(objectUrl.current);
      const href=URL.createObjectURL(blob); objectUrl.current=href;
      const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','image/svg+xml':'svg','audio/ogg':'ogg','audio/wav':'wav','audio/mpeg':'mp3','audio/mp4':'m4a','audio/webm':'webm','video/mp4':'mp4','video/webm':'webm'}[blob.type.split(';')[0]];
      const link=document.createElement('a'); link.href=href; link.download=/\.[a-z0-9]{2,5}$/i.test(filename)||!extension?filename:filename+'.'+extension; link.rel='noopener'; document.body.append(link); link.click(); link.remove();
      timer.current=setTimeout(() => { URL.revokeObjectURL(href); if(objectUrl.current===href)objectUrl.current=null; },250);
      setNotice('Archivo obtenido con tu sesión activa.');
    } catch(error) { if(alive.current){setNotice(error.message);onError?.(error);} }
    finally { if(alive.current)setBusy(false); }
  }
  return <><button type="button" className={className} disabled={disabled||busy} onClick={download}>{busy?'Descargando…':children}</button>{notice&&<small role="status">{notice}</small>}</>;
}
