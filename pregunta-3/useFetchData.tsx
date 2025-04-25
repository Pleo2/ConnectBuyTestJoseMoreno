import { useState, useEffect, useCallback } from "react";
import axios, { AxiosRequestConfig, AxiosError } from "a˝xios";

// Definimos una interfaz para el estado que devolverá el hook
interface FetchState<T> {
    data: T | null; // Los datos obtenidos (o null si no hay o hubo error)
    loading: boolean; // Indicador de si la petición está en curso
    error: AxiosError | null; // El objeto de error si la petición falló
}

/**
 * Custom Hook para realizar peticiones a una API con Axios.
 * Gestiona los estados de carga, error y los datos obtenidos.
 *
 * @template T El tipo de datos esperado en la respuesta exitosa.
 * @param {string | null} url La URL del endpoint de la API. Si es null, no se ejecuta la petición.
 * @param {AxiosRequestConfig} options Opciones adicionales para la petición Axios (method, headers, body, etc.).
 * @returns Un objeto con { data, loading, error } y una función `refetch`.
 */
function useFetchData<T = any>( // T = any como default si no se especifica tipo
    initialUrl: string | null,
    initialOptions: AxiosRequestConfig = {} // Opciones por defecto vacías
) {
    const [url, setUrl] = useState<string | null>(initialUrl);
    const [options, setOptions] = useState<AxiosRequestConfig>(initialOptions);

    // Estado interno del hook
    const [state, setState] = useState<FetchState<T>>({
        data: null,
        loading: false, // Inicialmente no estamos cargando si url es null o esperamos ejecución manual
        error: null
    });

    // Usamos useCallback para memorizar la función de fetch
    // y evitar recrearla en cada render si no cambian url/options
    const fetchData = useCallback(
        async (fetchUrl: string, fetchOptions: AxiosRequestConfig) => {
            // console.log('Fetching data for:', fetchUrl); // Log para depuración
            setState((prevState) => ({
                ...prevState, // Mantenemos data/error previos mientras carga
                loading: true,
                error: null // Limpiamos error previo al iniciar
            }));

            // Para cancelar la petición si el componente se desmonta o la url/options cambian
            const abortController = new AbortController();

            try {
                const response = await axios({
                    url: fetchUrl,
                    ...fetchOptions,
                    signal: abortController.signal // Asociamos el AbortController
                });

                // Petición exitosa
                setState({
                    data: response.data as T,
                    loading: false,
                    error: null
                });
            } catch (err) {
                if (axios.isCancel(err)) {
                    // Si el error es por cancelación, no lo consideramos un error "real"
                    console.log("Request canceled:", err.message);
                    // Mantenemos el estado como loading:false pero sin error ni data nueva
                    setState((prevState) => ({ ...prevState, loading: false }));
                } else {
                    // Error real de la petición (red, servidor, etc.)
                    console.error("Fetch error:", err);
                    setState({
                        data: null, // Reseteamos data en caso de error
                        loading: false,
                        error: err as AxiosError // Guardamos el objeto de error de Axios
                    });
                }
            }
            // Nota: No necesitamos 'finally' porque 'loading: false' se establece
            // tanto en el success (try) como en el error (catch).

            // La función de limpieza de useEffect llamará a abort si es necesario
            return () => {
                // console.log("Aborting previous fetch..."); // Log para depuración
                abortController.abort();
            };
        },
        []
    ); // useCallback no tiene dependencias directas, la lógica depende de useEffect

    // Efecto para ejecutar la petición cuando cambian la url o las opciones
    useEffect(() => {
        let cleanup = () => {}; // Función de limpieza vacía por defecto

        if (url) {
            // Solo ejecutar si la URL no es null
            // Ejecutamos fetchData y guardamos su función de limpieza
            // Usamos una IIFE async para poder usar await dentro de useEffect sincrónico
            (async () => {
                cleanup = await fetchData(url, options);
            })();
        } else {
            // Si la url es null, reseteamos el estado (opcional, según necesidad)
            setState({ data: null, loading: false, error: null });
        }

        // Función de limpieza: se ejecuta si el componente se desmonta
        // o si url/options cambian ANTES de ejecutar el siguiente efecto.
        return cleanup;
    }, [url, options, fetchData]); // Dependencias: url, options y la función fetchData memorizada

    // Función para permitir re-ejecutar la petición manualmente con los mismos url/options
    const refetch = useCallback(() => {
        if (url) {
            fetchData(url, options);
        } else {
            console.warn("Cannot refetch, URL is null.");
        }
    }, [url, options, fetchData]);

    // Función para cambiar la URL y disparar una nueva petición
    const setFetchUrl = useCallback((newUrl: string | null) => {
        setUrl(newUrl);
    }, []);

    // Función para cambiar las opciones y disparar una nueva petición
    const setFetchOptions = useCallback((newOptions: AxiosRequestConfig) => {
        setOptions(newOptions);
    }, []);

    // Devolvemos el estado y las funciones para interactuar
    return { ...state, refetch, setFetchUrl, setFetchOptions };
}

export default useFetchData;

// --- Ejemplo de Uso ---
/*
import React from 'react';
import useFetchData from './useFetchData'; // Asegúrate de que la ruta sea correcta

interface Post {
  userId: number;
  id: number;
  title: string;
  body: string;
}

function MyComponent() {
  const { data, loading, error, refetch, setFetchUrl } = useFetchData<Post[]>('https://jsonplaceholder.typicode.com/posts');
  const [postId, setPostId] = useState<number | null>(null);

  const handleFetchPost = (id: number) => {
    setPostId(id);
    setFetchUrl(`https://jsonplaceholder.typicode.com/posts/${id}`);
  }

  if (loading) {
    return <p>Cargando datos...</p>;
  }

  if (error) {
    return (
      <div>
        <p>Error al cargar datos: {error.message}</p>
        <p>Status: {error.response?.status}</p>
        <button onClick={refetch}>Intentar de nuevo</button>
      </div>
    );
  }

  // Si estamos mostrando un post individual
  if (postId && data && !Array.isArray(data)) {
     const post = data as unknown as Post; // Cast necesario si T puede ser array o objeto
      return (
          <div>
              <h2>Post Individual: {post.title}</h2>
              <p>{post.body}</p>
              <button onClick={() => {
                  setPostId(null);
                  setFetchUrl('https://jsonplaceholder.typicode.com/posts'); // Volver a la lista
              }}>
                  Volver a la lista
              </button>
          </div>
      )
  }

  // Si estamos mostrando la lista de posts
  return (
    <div>
      <h1>Posts</h1>
      <button onClick={refetch} style={{ marginBottom: '10px' }}>
        Recargar Lista
      </button>
      <ul>
        {data && Array.isArray(data) && data.map((post) => (
          <li key={post.id}>
            ({post.id}) {post.title}
            <button onClick={() => handleFetchPost(post.id)} style={{ marginLeft: '10px' }}>
                Ver Detalles
            </button>
          </li>
        ))}
      </ul>
       {(!data || (Array.isArray(data) && data.length === 0)) && !loading && <p>No hay posts para mostrar.</p>}
    </div>
  );
}

export default MyComponent;
*/
