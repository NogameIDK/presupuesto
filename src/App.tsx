import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Printer, User, Calculator, ShoppingCart, FileDown, AlertCircle, Share2 } from 'lucide-react';

// --- DEFINICIONES DE TIPOS (TypeScript) ---

// Extendemos el objeto Window para que reconozca la librería externa html2pdf
declare global {
  interface Window {
    html2pdf: any;
  }
}

// Estructura de un Item (Fila de producto)
interface Item {
  id: number | string; // Puede ser número o string (UUID)
  quantity: number;
  unit: string;
  description: string;
  price: number;
  hasIgv: boolean;
}

// Estructura de los datos del cliente
interface ClientData {
  name: string;
  location: string;
  date: string;
  budgetNumber: string;
  validity: string;
  deliveryTime: string;
  paymentCondition: string;
}

export default function App() {
  // --- Estado de Carga de Librería ---
  const [isPdfReady, setIsPdfReady] = useState<boolean>(false);

  // --- Carga de Librería PDF ---
  useEffect(() => {
    if (document.getElementById('html2pdf-script')) {
      setIsPdfReady(true);
      return;
    }
    const script = document.createElement('script');
    script.id = 'html2pdf-script';
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.async = true;
    script.onload = () => setIsPdfReady(true);
    script.onerror = () => console.error("Error al cargar la librería de PDF");
    document.body.appendChild(script);
  }, []);

  // --- Helpers ---
  const getLocalDate = (): string => {
    const d = new Date();
    const offset = d.getTimezoneOffset() * 60000;
    return new Date(d.getTime() - offset).toISOString().split('T')[0];
  };

  const round2 = (num: number): number => Math.round((num + Number.EPSILON) * 100) / 100;

  // --- Estados ---
  const [clientData, setClientData] = useState<ClientData>({
    name: '',
    location: '',
    date: getLocalDate(),
    budgetNumber: '00001',
    validity: '30 días',
    deliveryTime: '8 días',
    paymentCondition: '50%'
  });

  const [items, setItems] = useState<Item[]>([
    { id: 1, quantity: 1, unit: 'und', description: '', price: 0, hasIgv: true }
  ]);

  const logoUrl = 'https://i.postimg.cc/MKdW3GLk/imagen-2026-01-13-091459917.png';
  const [logoError, setLogoError] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>(''); 

  // --- Lógica Items ---
  const addItem = () => {
    // Genera un ID compatible (UUID string o timestamp number)
    const newId = window.crypto && window.crypto.randomUUID ? window.crypto.randomUUID() : Date.now() + Math.random();
    setItems([...items, { id: newId, quantity: 1, unit: 'und', description: '', price: 0, hasIgv: true }]);
  };

  const removeItem = (id: number | string) => {
    if (items.length > 1) setItems(items.filter(item => item.id !== id));
  };

  // Función genérica para actualizar campos. "value" puede ser string, number o boolean
  const updateItem = (id: number | string, field: keyof Item, value: string | number | boolean) => {
    setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));
  };

  // --- Cálculos ---
  const subtotalGlobal = items.reduce((acc, item) => acc + (item.quantity * item.price), 0);
  const igvTotal = items.reduce((acc, item) => item.hasIgv ? acc + ((item.quantity * item.price) * 0.18) : acc, 0);
  
  const finalSubtotal = round2(subtotalGlobal);
  const finalIgv = round2(igvTotal);
  const total = round2(finalSubtotal + finalIgv);

  // --- Configuración PDF ---
  const getPdfOptions = () => ({
    margin:       0,
    filename:     `Presupuesto-${clientData.name.replace(/[^a-z0-9]/gi, '_') || 'Cliente'}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, scrollY: 0, logging: false },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  });

  // --- GENERAR Y DESCARGAR PDF ---
  const generatePDF = () => {
    if (!isPdfReady || !window.html2pdf) {
      alert("Cargando sistema de impresión... espere un momento.");
      return;
    }
    setIsGenerating(true);
    setStatusMessage('Generando PDF...');
    
    const element = document.querySelector('.print-container');
    const opt = getPdfOptions();

    window.html2pdf().set(opt).from(element).save()
      .then(() => {
        setIsGenerating(false);
        setStatusMessage('');
      })
      .catch((err: any) => { // Se tipa el error como any
        console.error(err);
        setIsGenerating(false);
        setStatusMessage('');
        alert("Error al generar PDF.");
      });
  };

  // --- COMPARTIR POR WHATSAPP ---
  const shareViaWhatsApp = async () => {
    if (!isPdfReady || !window.html2pdf) {
      alert("Cargando sistema... intente de nuevo en unos segundos.");
      return;
    }

    setIsGenerating(true);
    setStatusMessage('Preparando archivo para WhatsApp...');
    
    const element = document.querySelector('.print-container');
    const opt = getPdfOptions();
    const fileName = opt.filename;

    try {
      // 1. Generar el PDF como un objeto "Blob" en memoria
      const pdfBlob = await window.html2pdf().set(opt).from(element).output('blob');
      const file = new File([pdfBlob], fileName, { type: 'application/pdf' });

      // 2. Verificar si el navegador soporta compartir archivos
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        setStatusMessage('Abriendo WhatsApp...');
        await navigator.share({
          files: [file],
          title: 'Presupuesto Decoraciones Cruz',
          text: `Hola ${clientData.name}, aquí le adjunto su presupuesto.`
        });
      } else {
        // 3. Fallback para PC
        setStatusMessage('Descargando archivo...');
        
        const url = URL.createObjectURL(pdfBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);

        setTimeout(() => {
            const text = encodeURIComponent(`Hola ${clientData.name || 'Cliente'}, le envío adjunto el presupuesto solicitado. (He descargado el PDF, por favor arrástrelo aquí).`);
            window.open(`https://wa.me/?text=${text}`, '_blank');
        }, 500);
      }
    } catch (err: any) { // Se tipa el error como any
      console.error("Error al compartir:", err);
      if (err.name !== 'AbortError') {
         alert("No se pudo abrir WhatsApp automáticamente. Use el botón de Descargar PDF.");
      }
    } finally {
      setIsGenerating(false);
      setStatusMessage('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-slate-800 flex flex-col md:flex-row">
      
      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.3); }

        @media print {
          .no-print { display: none !important; }
          body, html, #root { background: white !important; height: auto !important; margin: 0 !important; }
          .print-container { box-shadow: none !important; margin: 0 !important; width: 100% !important; border: none !important; padding: 0 !important; position: static !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      {/* === COLUMNA 1: EDITOR === */}
      <div className="w-full md:w-[420px] bg-slate-900 text-white p-6 overflow-y-auto h-screen no-print shadow-xl z-10 flex flex-col gap-6">
        
        <div className="flex items-center gap-2 mb-2">
          <Calculator className="text-blue-400" />
          <h1 className="text-xl font-bold">Creador de Presupuestos</h1>
        </div>

        {/* 1. Datos Generales */}
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 space-y-3">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-1 flex items-center gap-2">
            <User size={16}/> Datos Cliente
          </h3>
          <input 
            type="text" 
            placeholder="Nombre del Cliente" 
            value={clientData.name}
            onChange={(e) => setClientData({...clientData, name: e.target.value})}
            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none"
          />
          <input 
            type="text" 
            placeholder="Ubicación / Dirección" 
            value={clientData.location}
            onChange={(e) => setClientData({...clientData, location: e.target.value})}
            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 outline-none"
          />
          <div className="grid grid-cols-2 gap-2">
            <input 
              type="text" 
              placeholder="Nº Presupuesto" 
              value={clientData.budgetNumber}
              onChange={(e) => setClientData({...clientData, budgetNumber: e.target.value})}
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white"
            />
             <input 
              type="date" 
              value={clientData.date}
              onChange={(e) => setClientData({...clientData, date: e.target.value})}
              className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white"
            />
          </div>
        </div>

        {/* 2. Items */}
        <div className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex-1 flex flex-col">
          <h3 className="text-sm font-bold text-slate-400 uppercase mb-3 flex items-center gap-2">
            <ShoppingCart size={16}/> Productos o Servicios
          </h3>

          <div className="space-y-3 flex-1 overflow-y-auto pr-1 custom-scrollbar">
            {items.map((item, index) => (
              <div key={item.id} className="bg-slate-900 p-3 rounded border border-slate-700 relative group">
                <button 
                  onClick={() => removeItem(item.id)}
                  className="absolute top-2 right-2 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Eliminar fila"
                >
                  <Trash2 size={14} />
                </button>
                
                <div className="mb-2 pr-6">
                  <input 
                    value={item.description}
                    onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                    placeholder="Descripción..."
                    className="w-full bg-transparent border-b border-slate-700 focus:border-blue-500 outline-none text-sm pb-1 placeholder-slate-600"
                  />
                </div>

                <div className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-3">
                    <input 
                      type="number" min="0" value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value))}
                      className="w-full bg-transparent border border-slate-700 rounded p-1 text-xs text-center"
                      placeholder="Cant."
                    />
                    <div className="text-[9px] text-slate-500 text-center mt-0.5">Cant.</div>
                  </div>

                  <div className="col-span-3">
                    <select
                      value={item.unit} onChange={(e) => updateItem(item.id, 'unit', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded p-1 text-xs text-center text-white focus:border-blue-500 outline-none"
                    >
                      <option value="m2">m²</option>
                      <option value="ml">ml</option>
                      <option value="und">und</option>
                      <option value="glb">glb</option>
                      <option value="pza">pza</option>
                    </select>
                    <div className="text-[9px] text-slate-500 text-center mt-0.5">Unid.</div>
                  </div>

                  <div className="col-span-3">
                    <input 
                      type="number" min="0" step="0.01" value={item.price}
                      onChange={(e) => updateItem(item.id, 'price', Number(e.target.value))}
                      className="w-full bg-transparent border border-slate-700 rounded p-1 text-xs text-right"
                      placeholder="Precio"
                    />
                    <div className="text-[9px] text-slate-500 text-center mt-0.5">Precio</div>
                  </div>

                  <div className="col-span-3 flex flex-col items-center justify-center">
                    <input 
                      type="checkbox" checked={item.hasIgv}
                      onChange={(e) => updateItem(item.id, 'hasIgv', e.target.checked)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="text-[9px] text-slate-400 mt-0.5 font-medium">+IGV</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button 
            onClick={addItem}
            className="mt-4 w-full py-2 border border-dashed border-slate-600 text-slate-400 hover:text-blue-400 hover:border-blue-400 rounded transition-colors text-sm flex items-center justify-center gap-2"
          >
            <Plus size={16} /> Agregar Fila
          </button>
        </div>

        {/* Botones de Acción */}
        <div className="flex flex-col gap-3 mt-2">
           
           {/* BOTÓN WHATSAPP */}
           <button 
            onClick={shareViaWhatsApp}
            disabled={isGenerating || !isPdfReady}
            className={`w-full ${isGenerating ? 'bg-green-700 cursor-wait' : 'bg-green-500 hover:bg-green-400'} text-white font-bold py-3 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all`}
          >
            {isGenerating && statusMessage.includes('WhatsApp') ? (
              <span className="text-sm">{statusMessage}</span>
            ) : (
              <>
                <Share2 size={20} /> COMPARTIR WHATSAPP
              </>
            )}
          </button>

           <div className="grid grid-cols-2 gap-3">
             <button 
              onClick={generatePDF}
              disabled={isGenerating || !isPdfReady}
              className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 text-xs"
            >
              <FileDown size={16} /> DESCARGAR PDF
            </button>

            <button 
              onClick={() => {
                document.title = `Presupuesto-${clientData.name || 'Cliente'}`; 
                window.print();
              }}
              className="bg-slate-700 hover:bg-slate-600 text-white font-medium py-2 rounded-lg flex items-center justify-center gap-2 text-xs"
            >
              <Printer size={16} /> IMPRIMIR
            </button>
           </div>
        </div>

      </div>

      {/* === COLUMNA 2: VISTA PREVIA === */}
      <div className="flex-1 bg-gray-200 overflow-auto flex justify-center p-8">
        <div className="print-container bg-white shadow-2xl p-[40pt]" style={{ width: '210mm', minHeight: '297mm', position: 'relative' }}>
          
          <table cellSpacing={0} cellPadding={0} style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr style={{ height: '44.8pt' }}>
                <td rowSpan={2} style={{ width: '107.05pt', verticalAlign: 'top', border: 'solid 1px #fff' }}>
                  <div className="w-[143px] h-[159px] flex items-center justify-center bg-gray-50 border border-gray-100 overflow-hidden">
                    {logoError ? (
                       <div className="flex flex-col items-center justify-center text-gray-300 gap-1">
                          <AlertCircle size={24} />
                          <span className="text-[10px] text-center">Error imagen</span>
                       </div>
                    ) : (
                      <img 
                        src={logoUrl} alt="Logo" crossOrigin="anonymous" 
                        style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                        onError={() => setLogoError(true)} 
                      />
                    )}
                  </div>
                </td>
                <td colSpan={2} style={{ width: '324.7pt', verticalAlign: 'top', border: 'solid 1px #fff', paddingLeft: '15pt' }}>
                  <p style={{ marginTop: '0pt', marginBottom: '0pt', fontSize: '26pt', lineHeight: '1' }}>
                    <strong><span style={{ fontFamily: 'Tahoma', color: '#c00000' }}>DECORACIONES</span></strong>
                    <strong><span style={{ fontFamily: 'Tahoma', letterSpacing: '1.3pt', color: '#c00000', marginLeft: '5pt' }}>CRUZ</span></strong>
                  </p>
                </td>
              </tr>
              <tr style={{ height: '44.75pt' }}>
                <td colSpan={2} style={{ width: '324.7pt', verticalAlign: 'top', border: 'solid 1px #fff', paddingLeft: '15pt' }}>
                  <ul style={{ margin: '0pt', paddingLeft: '15pt', listStyleType: 'disc' }}>
                    {['Alfombras de rol', 'Alfombra modular', 'Piso laminado', 'Cortinas verticales'].map((serv, i) => (
                      <li key={i} style={{ fontFamily: 'serif', fontSize: '11pt', marginBottom: '2px' }}>
                        <span style={{ fontFamily: 'Arial, sans-serif' }}>{serv}</span>
                      </li>
                    ))}
                  </ul>
                  <p style={{ marginTop: '0pt', marginBottom: '0pt', fontSize: '12pt' }}>&nbsp;</p>
                </td>
              </tr>
              <tr>
                <td colSpan={2} style={{ verticalAlign: 'top', border: 'solid 1px #fff', paddingTop: '10pt' }}>
                  <p style={{ marginTop: '0pt', marginBottom: '0pt', fontSize: '11pt' }}>
                    <strong>LOCAL:</strong> FRANCISCO MASIAS 2692- LINCE
                  </p>
                </td>
                <td style={{ verticalAlign: 'top', border: 'solid 1px #fff', paddingTop: '10pt' }}>
                  <p style={{ marginTop: '0pt', marginBottom: '0pt', fontSize: '11pt', textAlign: 'right' }}>
                    <strong>Contacto</strong>: +51 921 440 560
                  </p>
                </td>
              </tr>
            </tbody>
          </table>

          <p style={{ marginTop: '0pt', marginBottom: '8pt' }}>&nbsp;</p>

          <table cellSpacing={0} cellPadding={0} style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              <tr>
                <td style={{ width: '109.45pt', border: '1px solid rgb(0, 0, 0)', verticalAlign: 'middle', padding: '4pt' }}>
                  <p style={{ margin: '0', fontSize: '11pt', fontWeight: 'bold' }}>PRESUPUESTO N.º:</p>
                </td>
                <td style={{ width: '60pt', border: '1px solid rgb(0, 0, 0)', verticalAlign: 'middle', textAlign: 'center', padding: '4pt' }}>
                  <p style={{ margin: '0', fontSize: '11pt' }}>{clientData.budgetNumber}</p>
                </td>
                <td style={{ border: '1px none rgb(255, 255, 255)', verticalAlign: 'top' }}>
                  <p style={{ margin: '0', fontSize: '12pt' }}>&nbsp;</p>
                </td>
                <td style={{ width: '64.55pt', border: '1px solid rgb(0, 0, 0)', verticalAlign: 'middle', padding: '4pt' }}>
                  <p style={{ margin: '0', fontSize: '11pt', fontWeight: 'bold' }}>FECHA:</p>
                </td>
                <td style={{ width: '80pt', border: '1px solid rgb(0, 0, 0)', verticalAlign: 'middle', textAlign: 'center', padding: '4pt' }}>
                  <p style={{ margin: '0', fontSize: '11pt' }}>{clientData.date}</p>
                </td>
              </tr>
            </tbody>
          </table>

          <p style={{ marginTop: '0pt', marginBottom: '15pt' }}>&nbsp;</p>

          <table cellSpacing={0} cellPadding={0} style={{ border: '0.75pt solid rgb(0, 0, 0)', borderCollapse: 'collapse', width: '100%' }}>
            <tbody>
              <tr>
                <td style={{ verticalAlign: 'top', border: '1px solid rgb(0, 0, 0)', padding: '5pt', backgroundColor: '#f0f0f0' }}>
                  <p style={{ margin: '0', fontSize: '11pt' }}><strong>INFORMACION DEL CLIENTE:</strong></p>
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid rgb(0, 0, 0)', verticalAlign: 'top', padding: '5pt' }}>
                  <p style={{ margin: '0 0 4pt 0', fontSize: '11pt' }}><strong>&nbsp;CLIENTE:</strong> {clientData.name || '................................................'}</p>
                  <p style={{ margin: '0', fontSize: '11pt' }}><strong>&nbsp;UBICACION:</strong> {clientData.location || '................................................'}</p>
                </td>
              </tr>
              <tr>
                <td style={{ border: '1px solid rgb(0, 0, 0)', verticalAlign: 'top', padding: '5pt' }}>
                  <p style={{ margin: '0', fontSize: '10pt' }}><strong>&nbsp;CONDICION DE PAGO:&nbsp;</strong>{clientData.paymentCondition}</p>
                  <p style={{ margin: '0', fontSize: '10pt' }}><strong>&nbsp;PLAZO DE ENTREGA:&nbsp;</strong>{clientData.deliveryTime}</p>
                  <p style={{ margin: '0', fontSize: '10pt' }}><strong>&nbsp;VALIDEZ DEL PRESUPUESTO:&nbsp;</strong>{clientData.validity}</p>
                  <p style={{ margin: '0', fontSize: '10pt' }}><strong>&nbsp;NUMERO DE CUENTA SCOTIABANK:&nbsp;</strong>009772207720076723-50 7720076723</p>
                </td>
              </tr>
            </tbody>
          </table>

          <p style={{ marginTop: '0pt', marginBottom: '15pt' }}>&nbsp;</p>

          <table style={{ width: '100%', borderCollapse: 'collapse', border: '1px solid black', fontSize: '11pt' }}>
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th style={{ border: '1px solid black', padding: '5px', width: '10%' }}>CANT.</th>
                <th style={{ border: '1px solid black', padding: '5px', width: '10%' }}>UNID.</th>
                <th style={{ border: '1px solid black', padding: '5px', textAlign: 'left' }}>DESCRIPCIÓN</th>
                <th style={{ border: '1px solid black', padding: '5px', width: '15%', textAlign: 'right' }}>P. UNIT</th>
                <th style={{ border: '1px solid black', padding: '5px', width: '15%', textAlign: 'right' }}>SUBTOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={{ border: '1px solid black', padding: '5px', textAlign: 'center' }}>{item.quantity}</td>
                  <td style={{ border: '1px solid black', padding: '5px', textAlign: 'center' }}>{item.unit}</td>
                  <td style={{ border: '1px solid black', padding: '5px' }}>{item.description}</td>
                  <td style={{ border: '1px solid black', padding: '5px', textAlign: 'right' }}>S/. {round2(item.price).toFixed(2)}</td>
                  <td style={{ border: '1px solid black', padding: '5px', textAlign: 'right' }}>S/. {round2(item.quantity * item.price).toFixed(2)}</td>
                </tr>
              ))}
              {[...Array(Math.max(0, 3 - items.length))].map((_, i) => (
                <tr key={`empty-${i}`}>
                  <td style={{ border: '1px solid black', padding: '5px', height: '24px' }}></td>
                  <td style={{ border: '1px solid black', padding: '5px' }}></td>
                  <td style={{ border: '1px solid black', padding: '5px' }}></td>
                  <td style={{ border: '1px solid black', padding: '5px' }}></td>
                  <td style={{ border: '1px solid black', padding: '5px' }}></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} style={{ border: '1px solid black', padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>
                  SUBTOTAL
                </td>
                <td style={{ border: '1px solid black', padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>
                  S/. {finalSubtotal.toFixed(2)}
                </td>
              </tr>
              {finalIgv > 0 && (
                <tr>
                  <td colSpan={4} style={{ border: '1px solid black', padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>IGV (18%)</td>
                  <td style={{ border: '1px solid black', padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>S/. {finalIgv.toFixed(2)}</td>
                </tr>
              )}
              <tr>
                <td colSpan={4} style={{ border: '1px solid black', padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>TOTAL</td>
                <td style={{ border: '1px solid black', padding: '5px', textAlign: 'right', fontWeight: 'bold' }}>S/. {total.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          <p style={{ marginTop: '0pt', marginBottom: '50pt' }}>&nbsp;</p>

          <table cellSpacing={0} cellPadding={0} style={{ width: '100%', borderCollapse: 'collapse', marginTop: 'auto' }}>
            <tbody>
              <tr style={{ height: '30.2pt' }}>
                <td style={{ width: '35%', verticalAlign: 'bottom', textAlign: 'center' }}>
                  <div style={{ borderTop: '1px solid black', paddingTop: '5px', width: '80%', margin: '0 auto' }}>
                    <p style={{ margin: '0', fontSize: '11pt' }}>{clientData.name || 'CLIENTE'}</p>
                  </div>
                </td>
                <td style={{ width: '30%' }}></td>
                <td style={{ width: '35%', verticalAlign: 'bottom', textAlign: 'center' }}>
                  <div style={{ borderTop: '1px solid black', paddingTop: '5px', width: '80%', margin: '0 auto' }}>
                    <p style={{ margin: '0', fontSize: '11pt' }}>Reihter Cruz</p>
                    <p style={{ margin: '0', fontSize: '10pt', color: '#666' }}>Decoraciones Cruz</p>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
          
        </div>
      </div>
    </div>
  );
}
