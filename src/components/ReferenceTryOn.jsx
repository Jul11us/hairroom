import React, { useRef } from "react";
import { ArrowUpRight, ImagePlus, LoaderCircle, Scissors, X } from "lucide-react";

export default function ReferenceTryOn({
  photo, reference, referenceName, loading, available, busy, locked, consent,
  onConsent, onPhoto, onReference, onRemove, onGenerate, onCancel,
  result, onResult, onAnnotate,
}) {
  const inputRef = useRef(null);
  return (
    <section className="reference-studio" aria-labelledby="reference-title">
      <div className="reference-heading">
        <span className="reference-symbol"><Scissors size={20} strokeWidth={1.4} /></span>
        <div>
          <span className="section-kicker">A LOOK YOU BROUGHT WITH YOU</span>
          <h3 id="reference-title">带着喜欢的发型来</h3>
          <p>你的照片 + 一张发型参考，试试新的轮廓。</p>
        </div>
      </div>
      <input ref={inputRef} className="sr-only" type="file"
        accept="image/jpeg,image/png,image/webp" aria-label="上传发型参考图"
        onChange={(event) => { onReference(event.target.files?.[0]); event.target.value = ""; }} />
      <div className="reference-images">
        <button className="reference-source" onClick={onPhoto} disabled={locked || loading}>
          {photo ? <img src={photo} alt="用于参考图试戴的你的照片" /> : <ImagePlus size={25} strokeWidth={1.3} />}
          <span>{photo ? "你的照片 · 点击更换" : "先上传自己的照片"}</span>
        </button>
        <span className="reference-plus" aria-hidden="true">+</span>
        <div className="reference-upload">
          <button className="reference-source" onClick={() => inputRef.current?.click()} disabled={loading || locked}>
            {reference ? <img src={reference} alt="你选择的发型参考图" /> : loading ? <LoaderCircle className="spin" size={25} /> : <ImagePlus size={25} strokeWidth={1.3} />}
            <span>{loading ? "正在准备参考图…" : reference ? "发型参考 · 点击更换" : "上传喜欢的发型"}</span>
          </button>
          {reference && <button className="reference-remove" aria-label="移除发型参考图" onClick={onRemove} disabled={locked}><X size={14} /></button>}
        </div>
      </div>
      {referenceName && <p className="reference-file">{referenceName}</p>}
      <p className="reference-explanation">借鉴参考图的长度、刘海与层次，保留你的五官和原发色。请选择清晰、头发完整的单人图片。</p>
      {available ? (
        <label className="consent-check reference-consent">
          <input type="checkbox" checked={consent} disabled={locked || !photo || !reference || loading} onChange={(event) => onConsent(event.target.checked)} />
          我同意将自己的照片和参考图发送至 OpenAI 生成试戴，可能产生 API 费用
        </label>
      ) : <p className="reference-unavailable" role="status">试戴服务尚未配置。两张照片只在当前页面预览；配置服务器 API key 后可生成。</p>}
      <div className="reference-actions">
        <button className="primary-button" onClick={onGenerate} disabled={!photo || !reference || !available || !consent || locked || loading}>
          {busy ? <><LoaderCircle size={15} className="spin" />正在生成参考图试戴…</> : <>{result ? "重新生成参考图试戴" : "按参考图生成试戴"}<ArrowUpRight size={15} /></>}
        </button>
        {busy && <button className="text-link" onClick={onCancel}>取消等待</button>}
      </div>
      {result && <div className="reference-result">
        <img src={result} alt="参考图生成的个人发型试戴结果" />
        <div><strong>参考图试戴已生成</strong><p>请核对五官、发际线和遮挡，再把想法标注给理发师。</p>
          <button className="text-link" onClick={onResult} disabled={locked || loading}>查看对比与沟通卡 <ArrowUpRight size={13} /></button>
          <button className="text-link" onClick={onAnnotate} disabled={locked || loading}>标注这张试戴</button>
        </div>
      </div>}
      <p className="reference-limit">生成图用于沟通参考，不能保证身份细节与实际剪发效果。刷新页面会清除照片。</p>
    </section>
  );
}
