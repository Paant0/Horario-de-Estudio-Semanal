"use strict";

    const CLAVE_ALMACENAMIENTO = "horario-estudio-semanal-v1";
    const DIAS = [
      { id: "lunes", nombre: "Lunes" },
      { id: "martes", nombre: "Martes" },
      { id: "miercoles", nombre: "Miércoles" },
      { id: "jueves", nombre: "Jueves" },
      { id: "viernes", nombre: "Viernes" },
      { id: "sabado", nombre: "Sábado" },
      { id: "domingo", nombre: "Domingo" }
    ];
    const MINUTO_INICIO_DIA = 6 * 60;
    const MINUTO_FIN_DIA = 22 * 60;
    const PIXELES_POR_MINUTO = 1;
    let materias = [];
    let sesiones = [];
    let materiaEnEdicion = null;
    let sesionEnEdicion = null;
    let temporizadorMensaje = null;

    const elementos = {
      mensaje: document.getElementById("mensaje"),
      formularioMateria: document.getElementById("form-materia"),
      nombreMateria: document.getElementById("nombre-materia"),
      objetivoMateria: document.getElementById("objetivo-materia"),
      guardarMateria: document.getElementById("guardar-materia"),
      cancelarMateria: document.getElementById("cancelar-materia"),
      listaMaterias: document.getElementById("lista-materias"),
      formularioSesion: document.getElementById("form-sesion"),
      materiaSesion: document.getElementById("sesion-materia"),
      diaSesion: document.getElementById("sesion-dia"),
      inicioSesion: document.getElementById("hora-inicio"),
      finSesion: document.getElementById("hora-fin"),
      guardarSesion: document.getElementById("guardar-sesion"),
      cancelarSesion: document.getElementById("cancelar-sesion"),
      totalSemanal: document.getElementById("total-semanal"),
      totalesDiarios: document.getElementById("totales-diarios"),
      totalesMaterias: document.getElementById("totales-materias"),
      encabezadosDias: document.getElementById("encabezados-dias"),
      cuerpoHorario: document.getElementById("cuerpo-horario"),
      horarioVacio: document.getElementById("horario-vacio"),
      listaSesiones: document.getElementById("lista-sesiones"),
      borrarTodo: document.getElementById("borrar-todo")
    };

    function crearId() {
      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
      }
      return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
    }

    function mostrarMensaje(texto, tipo) {
      clearTimeout(temporizadorMensaje);
      elementos.mensaje.textContent = texto;
      elementos.mensaje.className = "notice visible " + tipo;
      temporizadorMensaje = setTimeout(function () {
        elementos.mensaje.classList.remove("visible");
      }, 5500);
    }

    function guardarDatos() {
      try {
        localStorage.setItem(CLAVE_ALMACENAMIENTO, JSON.stringify({ materias: materias, sesiones: sesiones }));
        return true;
      } catch (error) {
        mostrarMensaje("No se pudieron guardar los cambios en este navegador. Comprueba el espacio disponible o la configuración de almacenamiento.", "error");
        return false;
      }
    }

    function recuperarDatos() {
      try {
        const guardado = localStorage.getItem(CLAVE_ALMACENAMIENTO);
        if (!guardado) return;
        const datos = JSON.parse(guardado);
        if (!datos || !Array.isArray(datos.materias) || !Array.isArray(datos.sesiones)) {
          throw new Error("La estructura guardada no es válida.");
        }
        const materiasValidas = datos.materias.filter(function (materia) {
          return materia && typeof materia.id === "string" &&
            typeof materia.nombre === "string" && materia.nombre.trim() &&
            Number.isFinite(materia.objetivo) && materia.objetivo > 0;
        });
        const idsMaterias = new Set(materiasValidas.map(function (materia) { return materia.id; }));
        const idsSesion = new Set();
        const sesionesValidas = datos.sesiones.filter(function (sesion) {
          if (!sesion || typeof sesion.id !== "string" || idsSesion.has(sesion.id) ||
              !idsMaterias.has(sesion.materiaId) || !DIAS.some(function (dia) { return dia.id === sesion.dia; }) ||
              !Number.isInteger(sesion.inicio) || !Number.isInteger(sesion.fin) ||
              sesion.inicio < MINUTO_INICIO_DIA || sesion.fin > MINUTO_FIN_DIA || sesion.fin <= sesion.inicio) {
            return false;
          }
          idsSesion.add(sesion.id);
          return true;
        });
        const sesionesSinCruces = sesionesValidas.filter(function (sesion, indice, lista) {
          return !lista.slice(0, indice).some(function (otra) {
            return sesion.dia === otra.dia && sesion.inicio < otra.fin && sesion.fin > otra.inicio;
          });
        });
        materias = materiasValidas;
        sesiones = sesionesSinCruces;
        if (sesiones.length !== datos.sesiones.length || materias.length !== datos.materias.length) {
          guardarDatos();
          mostrarMensaje("Se descartaron algunos datos guardados que estaban incompletos o no eran válidos.", "info");
        }
      } catch (error) {
        materias = [];
        sesiones = [];
        try {
          localStorage.removeItem(CLAVE_ALMACENAMIENTO);
        } catch (errorAlmacenamiento) {
          mostrarMensaje("No se pudieron recuperar los datos guardados ni limpiar el almacenamiento dañado.", "error");
          return;
        }
        mostrarMensaje("Los datos guardados estaban dañados y se inició un horario vacío.", "info");
      }
    }

    function escaparClave(nombre) {
      return nombre.trim().toLocaleLowerCase("es");
    }

    function obtenerMateria(id) {
      return materias.find(function (materia) { return materia.id === id; });
    }

    function minutosDesdeHora(hora) {
      const partes = hora.split(":").map(Number);
      return partes[0] * 60 + partes[1];
    }

    function horaDesdeMinutos(minutos) {
      const horas = Math.floor(minutos / 60).toString().padStart(2, "0");
      const resto = (minutos % 60).toString().padStart(2, "0");
      return horas + ":" + resto;
    }

    function duracionSesion(sesion) {
      return sesion.fin - sesion.inicio;
    }

    function formatoDuracion(minutos) {
      if (minutos === 0) return "0 h";
      const horas = Math.floor(minutos / 60);
      const resto = minutos % 60;
      if (horas === 0) return resto + " min";
      if (resto === 0) return horas + " h";
      return horas + " h " + resto + " min";
    }

    function formatoObjetivo(horas) {
      return formatoDuracion(Math.round(horas * 60));
    }

    function validarConflicto(sesion, idExcluido) {
      return sesiones.some(function (otra) {
        if (otra.id === idExcluido || otra.dia !== sesion.dia) return false;
        return sesion.inicio < otra.fin && sesion.fin > otra.inicio;
      });
    }

    function crearElemento(etiqueta, clase, texto) {
      const elemento = document.createElement(etiqueta);
      if (clase) elemento.className = clase;
      if (texto !== undefined) elemento.textContent = texto;
      return elemento;
    }

    function crearBoton(texto, clase, accion, id, etiqueta) {
      const boton = crearElemento("button", "button small " + clase, texto);
      boton.type = "button";
      boton.dataset.accion = accion;
      boton.dataset.id = id;
      if (etiqueta) boton.setAttribute("aria-label", etiqueta);
      return boton;
    }

    function renderizarMaterias() {
      const materiaSeleccionada = elementos.materiaSesion.value;
      elementos.listaMaterias.replaceChildren();
      elementos.materiaSesion.replaceChildren();
      const opcionInicial = crearElemento("option", "", materias.length ? "Selecciona una materia" : "Agrega primero una materia");
      opcionInicial.value = "";
      elementos.materiaSesion.append(opcionInicial);
      elementos.materiaSesion.disabled = materias.length === 0;

      materias.forEach(function (materia) {
        const opcion = crearElemento("option", "", materia.nombre);
        opcion.value = materia.id;
        elementos.materiaSesion.append(opcion);

        const item = crearElemento("li", "subject-item");
        const principal = crearElemento("div", "item-main");
        principal.append(
          crearElemento("span", "item-title", materia.nombre),
          crearElemento("span", "item-meta", "Objetivo: " + formatoObjetivo(materia.objetivo) + " por semana")
        );
        const acciones = crearElemento("div", "item-actions");
        acciones.append(
          crearBoton("Editar", "secondary", "editar-materia", materia.id, "Editar " + materia.nombre),
          crearBoton("Eliminar", "danger", "eliminar-materia", materia.id, "Eliminar " + materia.nombre)
        );
        item.append(principal, acciones);
        elementos.listaMaterias.append(item);
      });
      if (materias.some(function (materia) { return materia.id === materiaSeleccionada; })) {
        elementos.materiaSesion.value = materiaSeleccionada;
      }

      if (materias.length === 0) {
        elementos.listaMaterias.append(crearElemento("li", "empty-list", "Todavía no has registrado materias."));
      }
      if (materiaEnEdicion && !obtenerMateria(materiaEnEdicion)) cancelarEdicionMateria();
    }

    function renderizarResumen() {
      const totales = new Map(materias.map(function (materia) { return [materia.id, 0]; }));
      const porDia = new Map(DIAS.map(function (dia) { return [dia.id, 0]; }));
      let total = 0;
      sesiones.forEach(function (sesion) {
        const duracion = duracionSesion(sesion);
        total += duracion;
        porDia.set(sesion.dia, (porDia.get(sesion.dia) || 0) + duracion);
        totales.set(sesion.materiaId, (totales.get(sesion.materiaId) || 0) + duracion);
      });
      elementos.totalSemanal.textContent = formatoDuracion(total);
      elementos.totalesDiarios.replaceChildren();
      DIAS.forEach(function (dia) {
        const bloque = crearElemento("div", "day-total");
        bloque.append(crearElemento("span", "", dia.nombre), crearElemento("strong", "", formatoDuracion(porDia.get(dia.id) || 0)));
        elementos.totalesDiarios.append(bloque);
      });

      elementos.totalesMaterias.replaceChildren();
      materias.forEach(function (materia) {
        const programados = totales.get(materia.id) || 0;
        const objetivo = Math.round(materia.objetivo * 60);
        const diferencia = objetivo - programados;
        const fila = crearElemento("div", "subject-total");
        fila.append(
          crearElemento("span", "subject-total-name", materia.nombre),
          crearElemento("span", "subject-total-hours", formatoDuracion(programados) + " / " + formatoObjetivo(materia.objetivo))
        );
        let estado;
        if (diferencia > 0) {
          estado = "Faltan " + formatoDuracion(diferencia) + " para alcanzar el objetivo.";
        } else if (diferencia < 0) {
          estado = "Hay " + formatoDuracion(Math.abs(diferencia)) + " adicionales sobre el objetivo.";
        } else {
          estado = "Objetivo semanal alcanzado.";
        }
        fila.append(crearElemento("span", "subject-total-status" + (diferencia <= 0 ? " complete" : ""), estado));
        elementos.totalesMaterias.append(fila);
      });
      if (materias.length === 0) {
        elementos.totalesMaterias.append(crearElemento("p", "empty-list", "Agrega una materia para consultar su objetivo y progreso."));
      }
    }

    function tonoMateria(id) {
      let hash = 0;
      for (let indice = 0; indice < id.length; indice += 1) {
        hash = ((hash << 5) - hash + id.charCodeAt(indice)) | 0;
      }
      return Math.abs(hash) % 360;
    }

    function renderizarHorario() {
      elementos.encabezadosDias.replaceChildren();
      elementos.cuerpoHorario.replaceChildren();
      elementos.encabezadosDias.append(crearElemento("div", "day-heading", "Hora"));
      DIAS.forEach(function (dia) {
        elementos.encabezadosDias.append(crearElemento("div", "day-heading", dia.nombre));
      });

      const eje = crearElemento("div", "time-axis");
      for (let hora = 6; hora < 22; hora += 1) {
        eje.append(crearElemento("div", "time-label", hora.toString().padStart(2, "0") + ":00"));
      }
      elementos.cuerpoHorario.append(eje);
      DIAS.forEach(function (dia) {
        const columna = crearElemento("div", "day-column");
        columna.setAttribute("aria-label", dia.nombre);
        sesiones.filter(function (sesion) { return sesion.dia === dia.id; })
          .sort(function (a, b) { return a.inicio - b.inicio; })
          .forEach(function (sesion) {
            const materia = obtenerMateria(sesion.materiaId);
            if (!materia) return;
            const bloque = crearElemento("div", "session-block");
            bloque.style.top = ((sesion.inicio - MINUTO_INICIO_DIA) * PIXELES_POR_MINUTO) + "px";
            bloque.style.height = (duracionSesion(sesion) * PIXELES_POR_MINUTO) + "px";
            bloque.style.setProperty("--hue", tonoMateria(materia.id));
            bloque.setAttribute("aria-label", materia.nombre + ", " + dia.nombre + ", " + horaDesdeMinutos(sesion.inicio) + " a " + horaDesdeMinutos(sesion.fin));
            bloque.append(
              crearElemento("strong", "", materia.nombre),
              crearElemento("span", "", horaDesdeMinutos(sesion.inicio) + "–" + horaDesdeMinutos(sesion.fin))
            );
            columna.append(bloque);
          });
        elementos.cuerpoHorario.append(columna);
      });
      elementos.horarioVacio.classList.toggle("visible", sesiones.length === 0);
    }

    function renderizarSesiones() {
      elementos.listaSesiones.replaceChildren();
      const ordenadas = sesiones.slice().sort(function (a, b) {
        const ordenDiaA = DIAS.findIndex(function (dia) { return dia.id === a.dia; });
        const ordenDiaB = DIAS.findIndex(function (dia) { return dia.id === b.dia; });
        return ordenDiaA - ordenDiaB || a.inicio - b.inicio;
      });
      ordenadas.forEach(function (sesion) {
        const materia = obtenerMateria(sesion.materiaId);
        if (!materia) return;
        const dia = DIAS.find(function (elemento) { return elemento.id === sesion.dia; });
        const item = crearElemento("li", "session-item");
        const principal = crearElemento("div", "item-main");
        principal.append(
          crearElemento("span", "session-day", dia.nombre),
          crearElemento("span", "item-title", materia.nombre),
          crearElemento("span", "item-meta", horaDesdeMinutos(sesion.inicio) + "–" + horaDesdeMinutos(sesion.fin) + " · " + formatoDuracion(duracionSesion(sesion)))
        );
        const acciones = crearElemento("div", "item-actions");
        acciones.append(
          crearBoton("Editar", "secondary", "editar-sesion", sesion.id, "Editar sesión de " + materia.nombre + " el " + dia.nombre),
          crearBoton("Eliminar", "danger", "eliminar-sesion", sesion.id, "Eliminar sesión de " + materia.nombre + " el " + dia.nombre)
        );
        item.append(principal, acciones);
        elementos.listaSesiones.append(item);
      });
      if (ordenadas.length === 0) {
        elementos.listaSesiones.append(crearElemento("li", "empty-list", "Todavía no hay sesiones. Programa una para verla aquí."));
      }
    }

    function renderizarTodo() {
      renderizarMaterias();
      renderizarResumen();
      renderizarHorario();
      renderizarSesiones();
    }

    function cancelarEdicionMateria() {
      materiaEnEdicion = null;
      elementos.formularioMateria.reset();
      elementos.guardarMateria.textContent = "Agregar materia";
      elementos.cancelarMateria.hidden = true;
    }

    function cancelarEdicionSesion() {
      sesionEnEdicion = null;
      elementos.formularioSesion.reset();
      elementos.guardarSesion.textContent = "Agregar sesión";
      elementos.cancelarSesion.hidden = true;
    }

    function guardarMateria(evento) {
      evento.preventDefault();
      const nombre = elementos.nombreMateria.value.trim().replace(/\s+/g, " ");
      const objetivo = Number(elementos.objetivoMateria.value);
      if (!nombre) {
        mostrarMensaje("Escribe un nombre para la materia.", "error");
        elementos.nombreMateria.focus();
        return;
      }
      if (!Number.isFinite(objetivo) || objetivo <= 0) {
        mostrarMensaje("El objetivo semanal debe ser un número mayor que cero.", "error");
        elementos.objetivoMateria.focus();
        return;
      }
      const repetida = materias.some(function (materia) {
        return materia.id !== materiaEnEdicion && escaparClave(materia.nombre) === escaparClave(nombre);
      });
      if (repetida) {
        mostrarMensaje("Ya existe una materia con ese nombre. Los espacios y las mayúsculas no la hacen diferente.", "error");
        elementos.nombreMateria.focus();
        return;
      }

      const anteriores = materias;
      if (materiaEnEdicion) {
        materias = materias.map(function (materia) {
          return materia.id === materiaEnEdicion ? { id: materia.id, nombre: nombre, objetivo: objetivo } : materia;
        });
      } else {
        materias = materias.concat({ id: crearId(), nombre: nombre, objetivo: objetivo });
      }
      if (!guardarDatos()) {
        materias = anteriores;
        return;
      }
      const editada = Boolean(materiaEnEdicion);
      cancelarEdicionMateria();
      renderizarTodo();
      mostrarMensaje(editada ? "La materia se actualizó correctamente." : "La materia se agregó correctamente.", "success");
    }

    function guardarSesion(evento) {
      evento.preventDefault();
      const materiaId = elementos.materiaSesion.value;
      const dia = elementos.diaSesion.value;
      const horaInicio = elementos.inicioSesion.value;
      const horaFin = elementos.finSesion.value;
      if (!materiaId || !dia || !horaInicio || !horaFin) {
        mostrarMensaje("Completa la materia, el día, la hora de inicio y la hora de finalización.", "error");
        return;
      }
      if (!obtenerMateria(materiaId) || !DIAS.some(function (elemento) { return elemento.id === dia; })) {
        mostrarMensaje("Selecciona una materia y un día válidos.", "error");
        return;
      }
      const inicio = minutosDesdeHora(horaInicio);
      const fin = minutosDesdeHora(horaFin);
      if (inicio < MINUTO_INICIO_DIA || fin > MINUTO_FIN_DIA) {
        mostrarMensaje("Las sesiones deben comenzar desde las 06:00 y terminar antes o a las 22:00.", "error");
        return;
      }
      if (fin <= inicio) {
        mostrarMensaje("La hora de finalización debe ser posterior a la hora de inicio.", "error");
        elementos.finSesion.focus();
        return;
      }
      const sesion = { id: sesionEnEdicion || crearId(), materiaId: materiaId, dia: dia, inicio: inicio, fin: fin };
      if (validarConflicto(sesion, sesionEnEdicion)) {
        mostrarMensaje("Ese horario se superpone con otra sesión del mismo día. Elige un intervalo diferente.", "error");
        return;
      }

      const anteriores = sesiones;
      if (sesionEnEdicion) {
        sesiones = sesiones.map(function (existente) { return existente.id === sesionEnEdicion ? sesion : existente; });
      } else {
        sesiones = sesiones.concat(sesion);
      }
      if (!guardarDatos()) {
        sesiones = anteriores;
        return;
      }
      const editada = Boolean(sesionEnEdicion);
      cancelarEdicionSesion();
      renderizarTodo();
      elementos.materiaSesion.value = materiaId;
      elementos.diaSesion.value = dia;
      mostrarMensaje(editada ? "La sesión se actualizó correctamente." : "La sesión se agregó correctamente.", "success");
    }

    function iniciarEdicionMateria(id) {
      const materia = obtenerMateria(id);
      if (!materia) return;
      materiaEnEdicion = id;
      elementos.nombreMateria.value = materia.nombre;
      elementos.objetivoMateria.value = materia.objetivo;
      elementos.guardarMateria.textContent = "Guardar cambios";
      elementos.cancelarMateria.hidden = false;
      elementos.nombreMateria.focus();
    }

    function eliminarMateria(id) {
      const materia = obtenerMateria(id);
      if (!materia) return;
      const sesionesAsociadas = sesiones.filter(function (sesion) { return sesion.materiaId === id; });
      const pregunta = sesionesAsociadas.length
        ? "¿Eliminar “" + materia.nombre + "”? También se eliminarán sus " + sesionesAsociadas.length + " sesiones programadas."
        : "¿Eliminar la materia “" + materia.nombre + "”?";
      if (!window.confirm(pregunta)) return;
      const materiasAnteriores = materias;
      const sesionesAnteriores = sesiones;
      materias = materias.filter(function (elemento) { return elemento.id !== id; });
      sesiones = sesiones.filter(function (sesion) { return sesion.materiaId !== id; });
      if (!guardarDatos()) {
        materias = materiasAnteriores;
        sesiones = sesionesAnteriores;
        return;
      }
      if (materiaEnEdicion === id) cancelarEdicionMateria();
      renderizarTodo();
      mostrarMensaje(sesionesAsociadas.length
        ? "La materia y sus sesiones se eliminaron correctamente."
        : "La materia se eliminó correctamente.", "success");
    }

    function iniciarEdicionSesion(id) {
      const sesion = sesiones.find(function (elemento) { return elemento.id === id; });
      if (!sesion) return;
      sesionEnEdicion = id;
      elementos.materiaSesion.value = sesion.materiaId;
      elementos.diaSesion.value = sesion.dia;
      elementos.inicioSesion.value = horaDesdeMinutos(sesion.inicio);
      elementos.finSesion.value = horaDesdeMinutos(sesion.fin);
      elementos.guardarSesion.textContent = "Guardar cambios";
      elementos.cancelarSesion.hidden = false;
      elementos.materiaSesion.focus();
    }

    function eliminarSesion(id) {
      const sesion = sesiones.find(function (elemento) { return elemento.id === id; });
      if (!sesion) return;
      const materia = obtenerMateria(sesion.materiaId);
      const dia = DIAS.find(function (elemento) { return elemento.id === sesion.dia; });
      if (!window.confirm("¿Eliminar la sesión de " + (materia ? materia.nombre : "la materia") + " del " + dia.nombre + " de " + horaDesdeMinutos(sesion.inicio) + " a " + horaDesdeMinutos(sesion.fin) + "?")) return;
      const anteriores = sesiones;
      sesiones = sesiones.filter(function (elemento) { return elemento.id !== id; });
      if (!guardarDatos()) {
        sesiones = anteriores;
        return;
      }
      if (sesionEnEdicion === id) cancelarEdicionSesion();
      renderizarTodo();
      mostrarMensaje("La sesión se eliminó correctamente.", "success");
    }

    function borrarTodosLosDatos() {
      if (!materias.length && !sesiones.length) {
        mostrarMensaje("No hay datos que borrar.", "info");
        return;
      }
      if (!window.confirm("¿Borrar todas las materias y sesiones? Esta acción no se puede deshacer.")) return;
      const materiasAnteriores = materias;
      const sesionesAnteriores = sesiones;
      materias = [];
      sesiones = [];
      if (!guardarDatos()) {
        materias = materiasAnteriores;
        sesiones = sesionesAnteriores;
        return;
      }
      cancelarEdicionMateria();
      cancelarEdicionSesion();
      renderizarTodo();
      mostrarMensaje("Se borraron todas las materias y sesiones.", "success");
    }

    function manejarAccionLista(evento, tipoLista) {
      const boton = evento.target.closest("button[data-accion]");
      if (!boton || !evento.currentTarget.contains(boton)) return;
      const accion = boton.dataset.accion;
      const id = boton.dataset.id;
      if (tipoLista === "materias") {
        if (accion === "editar-materia") iniciarEdicionMateria(id);
        if (accion === "eliminar-materia") eliminarMateria(id);
      } else {
        if (accion === "editar-sesion") iniciarEdicionSesion(id);
        if (accion === "eliminar-sesion") eliminarSesion(id);
      }
    }

    DIAS.forEach(function (dia) {
      const opcion = crearElemento("option", "", dia.nombre);
      opcion.value = dia.id;
      elementos.diaSesion.append(opcion);
    });
    elementos.formularioMateria.addEventListener("submit", guardarMateria);
    elementos.formularioSesion.addEventListener("submit", guardarSesion);
    elementos.listaMaterias.addEventListener("click", function (evento) { manejarAccionLista(evento, "materias"); });
    elementos.listaSesiones.addEventListener("click", function (evento) { manejarAccionLista(evento, "sesiones"); });
    elementos.cancelarMateria.addEventListener("click", cancelarEdicionMateria);
    elementos.cancelarSesion.addEventListener("click", cancelarEdicionSesion);
    elementos.borrarTodo.addEventListener("click", borrarTodosLosDatos);

    recuperarDatos();
    renderizarTodo();
