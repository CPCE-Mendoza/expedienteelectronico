// ==========================================
// CONEXIÓN CON EL BACKEND (API) Y LÓGICA UI
// ==========================================

const API_URL = "https://script.google.com/macros/s/AKfycbz4LpSC0kN6Y3A_0x3TtjsZaw5kds7F6FbYabR_PKe2fQlO9Mdsu6xbD1E_JQCmdivJpQ/exec"; 
let expedienteActualId = null;

function mostrarToast(mensaje, tipo = 'success') {
    const toastEl = document.getElementById('sistema-toast');
    document.getElementById('toast-mensaje').innerText = mensaje;
    
    toastEl.classList.remove('bg-success', 'bg-danger', 'bg-warning', 'text-dark');
    if (tipo === 'success') toastEl.classList.add('bg-success');
    if (tipo === 'error') toastEl.classList.add('bg-danger');
    if (tipo === 'warning') toastEl.classList.add('bg-warning', 'text-dark');
    
    const toast = new bootstrap.Toast(toastEl, { delay: 4000 });
    toast.show();
}

async function callAPI(accion, payload = {}) {
    const token = localStorage.getItem('cpce_token');
    const response = await fetch(API_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ accion, token, payload, ip: "Web-Frontend" })
    });
    return response.json();
}

// --- AUTENTICACIÓN ---
async function iniciarSesion(e) {
    e.preventDefault(); 
    const btn = document.getElementById('btn-login');
    const errorDiv = document.getElementById('login-error');
    const successDiv = document.getElementById('login-success');
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;
    
    btn.innerHTML = "Validando...";
    btn.disabled = true;
    errorDiv.classList.add('d-none');
    if (successDiv) successDiv.classList.add('d-none');

    try {
        const data = await callAPI("login", { email, password });
        if (data.success) {
            if (data.require_password_change) {
                document.getElementById('form-login').style.display = 'none';
                document.getElementById('form-nueva-password').style.display = 'block';
                document.getElementById('reset-email').value = data.email;
                document.getElementById('reset-codigo').value = password; 
            } else {
                localStorage.setItem('cpce_token', data.token);
                localStorage.setItem('cpce_user', JSON.stringify(data.usuario));
                mostrarDashboard();
            }
        } else {
            mostrarError(data.error);
        }
    } catch (err) {
        mostrarError("No se pudo conectar con el servidor.");
    } finally {
        btn.innerHTML = "Ingresar al Sistema";
        btn.disabled = false;
    }
}

async function guardarNuevaPassword(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-pass');
    btn.disabled = true;
    
    const payload = {
        email: document.getElementById('reset-email').value,
        codigo_temporal: document.getElementById('reset-codigo').value,
        nueva_password: document.getElementById('new-password').value
    };

    try {
        const data = await callAPI("set_new_password", payload);
        if (data.success) {
            document.getElementById('form-nueva-password').style.display = 'none';
            document.getElementById('form-login').style.display = 'block';
            document.getElementById('password').value = '';
            
            const successDiv = document.getElementById('login-success');
            successDiv.innerText = "¡Contraseña actualizada! Ingrese de nuevo.";
            successDiv.classList.remove('d-none');
        } else {
            mostrarError(data.error);
        }
    } catch (err) {
        mostrarError("Error de conexión.");
    } finally {
        btn.disabled = false;
    }
}

function mostrarError(mensaje) {
    const errorDiv = document.getElementById('login-error');
    errorDiv.innerText = mensaje;
    errorDiv.classList.remove('d-none');
}

function cerrarSesion() {
    localStorage.removeItem('cpce_token');
    localStorage.removeItem('cpce_user');
    document.getElementById('vista-login').style.display = 'flex';
    document.getElementById('vista-dashboard').style.display = 'none';
    document.getElementById('vista-detalle-exp').style.display = 'none';
    document.getElementById('form-login').reset();
    document.getElementById('form-nueva-password').style.display = 'none';
    document.getElementById('form-login').style.display = 'block';
}

document.addEventListener('DOMContentLoaded', () => {
    if (localStorage.getItem('cpce_token')) mostrarDashboard();
});

// --- DASHBOARD ---
function mostrarDashboard() {
    document.getElementById('vista-login').style.display = 'none';
    document.getElementById('vista-detalle-exp').style.display = 'none';
    document.getElementById('vista-dashboard').style.display = 'block';
    
    const usuario = JSON.parse(localStorage.getItem('cpce_user'));
    document.getElementById('user-info').innerText = (usuario.nombre || usuario.email) + " | Rol: " + usuario.rol;
    
    const btnNuevoExp = document.getElementById('btn-nuevo-exp');
    const btnGestionUser = document.getElementById('btn-gestion-usuarios');
    const btnAuditoria = document.getElementById('btn-ver-auditoria');

    if (usuario.rol !== 'SECRETARIA') {
        if (btnNuevoExp) btnNuevoExp.style.display = 'none';
        if (btnGestionUser) btnGestionUser.style.display = 'none';
        if (btnAuditoria) btnAuditoria.style.display = 'none';
    } else {
        if (btnAuditoria) btnAuditoria.style.display = 'inline-block';
    }

    cargarExpedientes();
}

async function cargarExpedientes() {
    const tbody = document.getElementById('tabla-expedientes');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Cargando expedientes...</td></tr>';

    try {
        const data = await callAPI("list_expedientes");
        if (data.success) {
            tbody.innerHTML = ''; 
            if (data.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">No hay expedientes registrados.</td></tr>';
                return;
            }

            const usuario = JSON.parse(localStorage.getItem('cpce_user'));

            data.data.forEach(exp => {
                const fechaFormat = new Date(exp.fecha).toLocaleDateString();
                let colorEstado = "bg-info text-dark";
                if (exp.estado === "PENDIENTE") colorEstado = "bg-warning text-dark";
                else if (exp.estado === "EN PROCESO") colorEstado = "bg-primary";
                else if (exp.estado === "RESUELTO") colorEstado = "bg-success";
                else if (exp.estado === "ARCHIVADO") colorEstado = "bg-dark";

                tbody.innerHTML += `
                    <tr>
                        <td class="fw-bold">${exp.nro_expediente}</td>
                        <td><span class="badge bg-secondary">${exp.area.replace('_', ' ')}</span></td>
                        <td><span class="badge ${colorEstado}">${exp.estado}</span></td>
                        <td>${fechaFormat}</td>
                        <td>
                            <button class="btn btn-sm btn-outline-primary" onclick="abrirDetalle('${exp.id}', '${exp.nro_expediente}')">Ver Detalle</button>
                            ${usuario.rol === 'SECRETARIA' ? `<button class="btn btn-sm btn-outline-danger ms-1" onclick="confirmarEliminarExpediente('${exp.id}')">Borrar</button>` : ''}
                        </td>
                    </tr>
                `;
            });
        } else if (data.code === "UNAUTHORIZED") {
            cerrarSesion();
        }
    } catch (err) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-danger py-4">Error de conexión.</td></tr>';
    }
}

async function crearExpediente(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-exp');
    const errorDiv = document.getElementById('modal-error');
    btn.disabled = true;
    errorDiv.classList.add('d-none');

    const payload = {
        nro_expediente: document.getElementById('exp-nro').value,
        area: document.getElementById('exp-area').value
    };

    try {
        const data = await callAPI("create_expediente", payload);
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('modalNuevoExp')).hide();
            document.getElementById('form-nuevo-exp').reset();
            cargarExpedientes();
            mostrarToast("Expediente creado correctamente", "success");
        } else {
            errorDiv.innerText = data.error;
            errorDiv.classList.remove('d-none');
        }
    } catch (err) {
        errorDiv.innerText = "Error de conexión.";
        errorDiv.classList.remove('d-none');
    } finally {
        btn.disabled = false;
    }
}

async function confirmarEliminarExpediente(idExpediente) {
    if (confirm("¿Está seguro de borrar este expediente del sistema?")) {
        const data = await callAPI("delete_expediente", { id_expediente: idExpediente });
        if (data.success) {
            mostrarToast("Expediente eliminado.", "success");
            cargarExpedientes();
        } else {
            mostrarToast(data.error, "error");
        }
    }
}

// --- DETALLE DEL EXPEDIENTE ---
function abrirDetalle(idExpediente, nroExpediente) {
    expedienteActualId = idExpediente;
    document.getElementById('vista-dashboard').style.display = 'none';
    document.getElementById('vista-detalle-exp').style.display = 'block';
    document.getElementById('detalle-nro-exp').innerText = nroExpediente || "Gestión de Expediente";
    
    const usuario = JSON.parse(localStorage.getItem('cpce_user'));
    
    const selectorEstado = document.getElementById('selector-estado-exp');
    if (['SECRETARIA', 'INSTRUCTOR', 'TRIBUNAL'].includes(usuario.rol)) {
        if (selectorEstado) selectorEstado.style.display = 'block';
    } else {
        if (selectorEstado) selectorEstado.style.display = 'none';
    }

    const btnAsignar = document.getElementById('btn-asignar-partes');
    const btnSubirFoja = document.getElementById('btn-subir-foja');
    if (['SECRETARIA', 'INSTRUCTOR'].includes(usuario.rol)) {
        if (btnAsignar) btnAsignar.style.display = 'block';
        if (btnSubirFoja) btnSubirFoja.style.display = 'block';
    } else {
        if (btnAsignar) btnAsignar.style.display = 'none';
        if (btnSubirFoja) btnSubirFoja.style.display = 'none';
    }

    const seccionNotas = document.getElementById('seccion-notas-container');
    if (usuario.rol === 'INVESTIGADO') {
        if (seccionNotas) seccionNotas.style.display = 'none';
    } else {
        if (seccionNotas) seccionNotas.style.display = 'block';
        cargarNotas(idExpediente);
    }

    cargarFojas(idExpediente);
}

function volverDashboard() {
    expedienteActualId = null;
    document.getElementById('vista-detalle-exp').style.display = 'none';
    document.getElementById('vista-dashboard').style.display = 'block';
}

async function cargarFojas(idExpediente) {
    const tbody = document.getElementById('tabla-fojas');
    tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4">Cargando documentos...</td></tr>';

    try {
        const data = await callAPI("list_fojas", { id_expediente: idExpediente });
        if (data.success) {
            tbody.innerHTML = ''; 
            if (data.data.length === 0) {
                tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">Aún no hay fojas cargadas.</td></tr>';
                return;
            }
            
            const usuario = JSON.parse(localStorage.getItem('cpce_user'));

            data.data.forEach(foja => {
                const fechaFormat = new Date(foja.fecha).toLocaleDateString();
                const badgeColor = foja.confidencialidad === 'PUBLICO' ? 'bg-success' : 'bg-danger';
                
                let fileId = foja.link_drive.match(/\/d\/([a-zA-Z0-9_-]+)/) || foja.link_drive.match(/id=([a-zA-Z0-9_-]+)/);
                let urlDocumento = fileId ? "https://drive.google.com/file/d/" + fileId[1] + "/view" : foja.link_drive;
                
                tbody.innerHTML += `
                    <tr>
                        <td class="align-middle fw-bold">Foja ${foja.foja_inicio || 1}</td>
                        <td class="align-middle fw-bold">${foja.nombre}</td>
                        <td class="align-middle"><span class="badge ${badgeColor}">${foja.confidencialidad}</span></td>
                        <td class="align-middle">${fechaFormat}</td>
                        <td class="align-middle">
                            <a href="${urlDocumento}" target="_blank" class="btn btn-sm btn-outline-primary">Ver PDF</a>
                            ${usuario.rol === 'SECRETARIA' ? `<button class="btn btn-sm btn-outline-danger ms-1" onclick="confirmarEliminarFoja('${foja.id_foja}')">Eliminar</button>` : ''}
                        </td>
                    </tr>
                `;
            });
        }
    } catch (err) {
        console.error("Error al cargar fojas", err);
    }
}

async function procesarSubidaFoja(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-foja');
    const errorDiv = document.getElementById('error-foja');
    btn.disabled = true;
    errorDiv.classList.add('d-none');

    const payload = {
        id_expediente: expedienteActualId,
        nombre_archivo: document.getElementById('titulo-foja').value,
        confidencialidad: document.getElementById('confidencialidad-foja').value,
        link_drive: document.getElementById('link-drive').value,
        foja_inicio: document.getElementById('foja-inicio') ? document.getElementById('foja-inicio').value : 1
    };

    try {
        const data = await callAPI("upload_foja", payload);
        if (data.success) {
            bootstrap.Modal.getInstance(document.getElementById('modalSubirFoja')).hide();
            document.getElementById('form-subir-foja').reset();
            cargarFojas(expedienteActualId);
            mostrarToast("Foja vinculada correctamente", "success");
        } else {
            errorDiv.innerText = data.error;
            errorDiv.classList.remove('d-none');
        }
    } catch (err) {
        errorDiv.innerText = "Error de conexión.";
        errorDiv.classList.remove('d-none');
    } finally {
        btn.disabled = false;
    }
}

async function confirmarEliminarFoja(idFoja) {
    if (confirm("¿Desea borrar esta foja duplicada o errónea?")) {
        const data = await callAPI("delete_foja", { id_foja: idFoja });
        if (data.success) {
            mostrarToast("Foja eliminada.", "success");
            cargarFojas(expedienteActualId);
        } else {
            mostrarToast(data.error, "error");
        }
    }
}

async function verExpedienteCompleto() {
    const btn = document.getElementById('btn-ver-expediente-completo');
    btn.disabled = true;
    btn.innerText = "Cargando...";

    try {
        const data = await callAPI("get_full_pdf", { id_expediente: expedienteActualId });
        if (data.success) {
            let htmlContent = "<h2>EXPEDIENTE UNIFICADO - CORRIDO</h2>";
            data.fojas.forEach(f => {
                htmlContent += `<div style='margin-bottom:30px;'><h3>${f.nombre} (Foja ${f.fojaInicio})</h3><iframe src="${f.urlDirecta}" width="100%" height="800px" frameborder="0"></iframe></div>`;
            });
            let win = window.open("", "_blank");
            win.document.write("<html><head><title>Expediente Completo</title></head><body style='font-family:sans-serif; padding:20px; background:#F3F5F8;'>" + htmlContent + "</body></html>");
        } else {
            mostrarToast(data.error, "error");
        }
    } catch(e) {
        mostrarToast("Error al cargar visor corrido.", "error");
    } finally {
        btn.disabled = false;
        btn.innerText = "Ver Expediente Completo";
    }
}

// --- NOTAS Y USUARIOS ---
async function cargarNotas(idExpediente) {
    const contenedor = document.getElementById('contenedor-notas');
    contenedor.innerHTML = '<p class="text-muted text-center py-3">Cargando notas...</p>';
    
    try {
        const data = await callAPI("list_notas", { id_expediente: idExpediente });
        if (data.success) {
            contenedor.innerHTML = '';
            if (data.data.length === 0) {
                contenedor.innerHTML = '<p class="text-muted text-center py-3">No hay notas registradas.</p>';
                return;
            }
            data.data.forEach(nota => {
                const fechaFormat = new Date(nota.fecha).toLocaleString();
                contenedor.innerHTML += `
                    <div class="mb-3 p-3 bg-white border rounded shadow-sm">
                        <div class="d-flex justify-content-between mb-1">
                            <strong class="text-primary-cpce">${nota.autor}</strong>
                            <small class="text-muted">${fechaFormat}</small>
                        </div>
                        <p class="mb-0">${nota.texto}</p>
                    </div>
                `;
            });
            contenedor.scrollTop = contenedor.scrollHeight;
        }
    } catch (err) {
        console.error("Error al cargar notas", err);
    }
}

async function guardarNota(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-nota');
    const inputTexto = document.getElementById('texto-nota');
    btn.disabled = true;
    
    const usuarioLocal = JSON.parse(localStorage.getItem('cpce_user')); 
    const payload = { 
        id_expediente: expedienteActualId, 
        texto: inputTexto.value,
        autor: usuarioLocal.nombre || usuarioLocal.email
    };

    try {
        const data = await callAPI("add_nota", payload);
        if (data.success) {
            inputTexto.value = ''; 
            cargarNotas(expedienteActualId); 
            mostrarToast("Nota agregada exitosamente", "success");
        } else {
            mostrarToast(data.error, 'error');
        }
    } catch (err) {
        mostrarToast("Error de conexión.", "error");
    } finally {
        btn.disabled = false;
    }
}

async function crearUsuarioFront(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-crear-user');
    const errorDiv = document.getElementById('modal-user-error');
    const successDiv = document.getElementById('modal-user-success');
    btn.disabled = true;
    errorDiv.classList.add('d-none');
    successDiv.classList.add('d-none');

    const payload = {
        nombre: document.getElementById('new-user-nombre').value,
        email: document.getElementById('new-user-email').value,
        rol: document.getElementById('new-user-rol').value
    };

    try {
        const data = await callAPI("create_user", payload);
        if (data.success) {
            successDiv.innerText = data.message;
            successDiv.classList.remove('d-none');
            document.getElementById('form-nuevo-usuario').reset();
            mostrarToast("Usuario creado correctamente", "success");
            setTimeout(() => {
                bootstrap.Modal.getInstance(document.getElementById('modalNuevoUsuario')).hide();
            }, 2000);
        } else {
            errorDiv.innerText = data.error;
            errorDiv.classList.remove('d-none');
        }
    } catch (err) {
        errorDiv.innerText = "Error de conexión.";
        errorDiv.classList.remove('d-none');
    } finally {
        btn.disabled = false;
    }
}

function filtrarExpedientes() {
    const texto = document.getElementById('buscador-exp').value.toLowerCase();
    const filtroArea = document.getElementById('filtro-area').value.toLowerCase();
    const filtroEstado = document.getElementById('filtro-estado').value.toLowerCase();
    
    const filas = document.querySelectorAll('#tabla-expedientes tr');
    filas.forEach(fila => {
        if (fila.cells.length < 5) return; 
        const textoCaratula = fila.cells[0].innerText.toLowerCase();
        const textoArea = fila.cells[1].innerText.toLowerCase();
        const textoEstado = fila.cells[2].innerText.toLowerCase();
        
        const cumpleTexto = textoCaratula.includes(texto);
        const cumpleArea = filtroArea === "" || textoArea.includes(filtroArea);
        const cumpleEstado = filtroEstado === "" || textoEstado.includes(filtroEstado);
        
        fila.style.display = (cumpleTexto && cumpleArea && cumpleEstado) ? '' : 'none';
    });
}

async function cambiarEstadoExp(nuevoEstado) {
    if (!confirm(`¿Desea cambiar el estado a "${nuevoEstado}"?`)) return;
    try {
        const data = await callAPI("change_status", { id_expediente: expedienteActualId, nuevo_estado: nuevoEstado });
        if (data.success) mostrarToast("Estado actualizado.", "success");
        else mostrarToast(data.error, "error");
    } catch (err) {
        mostrarToast("Error de conexión.", "error");
    }
}

async function guardarPartes(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-guardar-partes');
    btn.disabled = true;
    const payload = {
        id_expediente: expedienteActualId,
        email_abogado: document.getElementById('email-abogado').value,
        email_investigado: document.getElementById('email-investigado').value
    };

    try {
        const data = await callAPI("assign_parties", payload);
        if (data.success) {
            mostrarToast("Partes asignadas correctamente.", "success");
            bootstrap.Modal.getInstance(document.getElementById('modalAsignarPartes')).hide();
        } else {
            mostrarToast(data.error, "error");
        }
    } catch (err) {
        mostrarToast("Error de conexión.", "error");
    } finally {
        btn.disabled = false;
    }
}

async function cargarAuditoria() {
    const tbody = document.getElementById('tabla-auditoria');
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-4">Cargando...</td></tr>';
    try {
        const data = await callAPI("list_audit");
        if (data.success) {
            tbody.innerHTML = '';
            data.data.reverse().forEach(log => {
                tbody.innerHTML += `
                    <tr>
                        <td><small>${new Date(log.fecha).toLocaleString()}</small></td>
                        <td><small>${log.usuario.split('-')[0]}...</small></td>
                        <td><span class="badge bg-secondary">${log.accion}</span></td>
                        <td>${log.entidad}</td>
                        <td><small>${log.id_entidad.split('-')[0] || '-'}</small></td>
                        <td><small>${log.ip}</small></td>
                    </tr>
                `;
            });
        }
    } catch (err) {
        mostrarToast("Error al cargar auditoría.", 'error');
    }
}
function abrirAuditoria() {
    document.getElementById('vista-dashboard').style.display = 'none';
    document.getElementById('vista-auditoria').style.display = 'block';
    cargarAuditoria();
}
function volverDashboardDesdeAuditoria() {
    document.getElementById('vista-auditoria').style.display = 'none';
    document.getElementById('vista-dashboard').style.display = 'block';
}