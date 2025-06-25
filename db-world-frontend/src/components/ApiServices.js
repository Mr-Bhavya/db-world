import axios from 'axios'
import CommonServices from './CommonServices';
const REACT_APP_BASEURL = process.env.REACT_APP_BASEURL;

export const doLogin = async (email, password) => {
    let response = await fetch(REACT_APP_BASEURL + "/api/auth/login", {
        method: "POST",
        headers: {
            "content-type": "application/json",
        },
        body: JSON.stringify({ email, password })
    })
    return response.json();
}

export const register = async (user) => {
    const response = await fetch(REACT_APP_BASEURL + "/api/auth/register", {
        method: "POST",
        headers: {
            "content-type": "application/json"
        }, body: JSON.stringify(user)
    })
    return response.json();
}

export const findAllUsersService = async () => {
    // return await axios.get(Constants.FIND_ALL_USERS_API)
    return await axios.get(REACT_APP_BASEURL + "/api/admin/user");

}

export const deleteUser = async (userId) => {
    const response = await fetch(`${REACT_APP_BASEURL}/api/admin/user/${userId}`, {
        method: "DELETE",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    })
    return await response.json();
}

export const updateDobForUser = async (dob) => {
    const response = await fetch(`${REACT_APP_BASEURL}/api/user/dob=${dob}`, {
        method: "PUT",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    })
    return await response.json();
}

export const getAllUsers = async () => {
    let response = await fetch(REACT_APP_BASEURL + "/api/admin/user", {
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    })
    return response.json();
}

export const getUserRole = async () => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/user/role`, {
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    })
    return await response.json();
}

export const getAllUserRoles = async () => {
    let response = await fetch(REACT_APP_BASEURL + "/api/role/", {
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    })
    return await response.json();
}

export const getUserDetail = async () => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/user/`, {
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const updateUserDetails = async (user) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/user/${user.userId}`, {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        },
        body: JSON.stringify(user)
    })
    return await response.json();
}

export const updateUserRoleService = async (doer_id, userId, role) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/admin/user/${userId}/role`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        },
        body: JSON.stringify(role)
    })
    return await response.json();
}

export const searchTmdbByQuery = async (recordType, query, year) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/admin/cinema/tmdb/${recordType}/search?q=${query}${!year || typeof (year) == "undefined" || year == "" ? "" : "&year=" + year}`, {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    })
    return await response.json();
}

export const AddDbCinemaRecord = async (name, type, tmdbId) => {
    let response = await fetch(REACT_APP_BASEURL + "/api/admin/cinema/record", {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        },
        body: JSON.stringify({ name, type, tmdbId })
    })
    return await response.json();
}

export const UpdateDbCinemaRecord = async (recordId, body) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/admin/cinema/record/${recordId}`, {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        },
        body: JSON.stringify(body)
    })
    return await response.json();
}

export const changeShowOnTopRecord = async (recordId, showOnTop) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/admin/cinema/record/${recordId}/showOnTop=${showOnTop}`, {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    })
    return await response.json();
}

export const deleteDbCinemaRecord = async (recordId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/admin/cinema/record/${recordId}`, {
        method: "DELETE",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    })
    return await response.json();
}

export const loadDbCinemaRecords = async (industry, type, genres, pageNumber) => {

    var api = "";
    if (industry === "all") {
        // api = `${REACT_APP_BASEURL}/api/media/movie?industry=${filter.movieIndustry}&page=${recordsPageNumberList.all}`
        api = `${REACT_APP_BASEURL}/api/cinema/record/type/${type}?page=${pageNumber}`
    }
    else if (industry === "bollywood") {
        // api = `${REACT_APP_BASEURL}/api/media/movie?industry=${filter.movieIndustry}&page=${recordsPageNumberList.bollywood}`
        api = `${REACT_APP_BASEURL}/api/cinema/record/type/${type}?page=${pageNumber}&languages=hi`
    }
    else if (industry === "hollywood") {
        // api = `${REACT_APP_BASEURL}/api/media/movie?industry=${filter.movieIndustry}&page=${recordsPageNumberList.hollywood}`
        api = `${REACT_APP_BASEURL}/api/cinema/record/type/${type}?page=${pageNumber}&languages=en`
    }
    else if (industry === "korean") {
        // api = `${REACT_APP_BASEURL}/api/media/movie?industry=${filter.movieIndustry}&page=${recordsPageNumberList.hollywood}`
        api = `${REACT_APP_BASEURL}/api/cinema/record/type/${type}?page=${pageNumber}&languages=ko`
    }
    else if (industry === "south") {
        // api = `${REACT_APP_BASEURL}/api/media/movie?industry=${filter.movieIndustry}&page=${recordsPageNumberList.south}`
        api = `${REACT_APP_BASEURL}/api/cinema/record/type/${type}?page=${pageNumber}&languages=ta,te,ml,kn`
    }
    else if (industry === "gujarati") {
        // api = `${REACT_APP_BASEURL}/api/media/movie?industry=${filter.movieIndustry}&page=${recordsPageNumberList.gujarati}`
        api = `${REACT_APP_BASEURL}/api/cinema/record/type/${type}?page=${pageNumber}&languages=gu`
    }

    // api = `${REACT_APP_BASEURL}/api/cinema/record/type/${type}?page=${recordsPageNumberList.gujarati}&languages=gu`

    if (genres && genres.length > 0) {
        api += `&genres=${genres.join(",")}`
    }

    const response = await fetch(api, {
        method: "GET",
        credentials: "include",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();

}

export const loadMyWatchlist = async (userId) => {
    const response = await fetch(`${REACT_APP_BASEURL}/api/cinema/watchlist?userId=${userId}`, {
        method: "GET",
        credentials: "include",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const searchRecord = async (query, page, size) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/record?q=${query}&page=${page}&size=${size}`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    })
    return await response.json();
}

export const adminSearchRecord = async (query) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/admin/cinema/record/search?q=${query}`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    })
    return await response.json();
}

export const searchStreamFile = async (query) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/stream/search?q=${query}`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    })
    return await response.json();
}

export const loadStreamFileInfoByRecordId = async (recordId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/stream/media-info/${recordId}`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    })
    return await response.json();
}

export const loadStreamFileInfoByFiledId = async (fileId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/stream/media-info/file/${fileId}`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    })
    return await response.json();
}


export const likeRecord = async (recordId, userId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/record/${recordId}/like?userId=${userId}`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const unLikeRecord = async (recordId, userId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/record/${recordId}/unlike?userId=${userId}`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const watchlistRecord = async (recordId, userId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/record/${recordId}/watchlist?userId=${userId}`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const removeWatchlistRecord = async (recordId, userId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/record/${recordId}/unwatchlist`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const markRecordWatched = async (recordId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/record/${recordId}/watch`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const unmarkRecordWatched = async (recordId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/record/${recordId}/unwatch`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const getGenresList = async () => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/genres`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const getRecords = async () => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/admin/cinema/record`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const getRecordDetailsbyId = async (recordId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/record/${recordId}`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const getStreamMediaList = async (path) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/file-explorer/list?directory=${path}`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const findAllHost = async () => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/pm/host`, {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const addCredential = async (credential) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/pm/`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        },
        body: JSON.stringify(credential)
    });
    return await response.json();
}

export const updateCredential = async (pmId, credential) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/pm/${pmId}`, {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        },
        body: JSON.stringify(credential)
    });
    return await response.json();
}

export const getCredential = async () => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/pm/`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const deleteCredentialByCredentialId = async (credentialId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/pm/credential/${credentialId}`, {
        method: "DELETE",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const deleteHostById = async (pmId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/pm/${pmId}`, {
        method: "DELETE",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const applicationLogsApi = async () => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/utils/logs`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const mirror = async (body) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/utils/mirror`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        },
        body: JSON.stringify(body)
    });
    return await response.json();
}

export const cancelledMirror = async (statusId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/utils/mirror/${statusId}`, {
        method: "DELETE",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const mirrorStatus = async () => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/utils/mirror/status`, {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const deleteMirror = async (statusId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/utils/mirror/status/${statusId}`, {
        method: "DELETE",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const updateRecordsWithLatest = async () => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/admin/cinema/records/update`, {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const recordsUpdateStatus = async () => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/records/update/status`, {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const systemInfo = async () => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/utils/system-info`, {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const ytInfo = async (url) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/utils/yt/info?url=${url}`, {
        method: "GET",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const ytDownload = async (body) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/utils/yt/download`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        },
        body: JSON.stringify(body)
    });
    return await response.json();
}

export const renameStreamFile = async (fileId, body) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/stream/file/${fileId}`, {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        },
        body
    });
    return await response.json();
}

export const deleteStreamFile = async (fileId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/stream/file/${fileId}`, {
        method: "DELETE",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const deleteTempFile = async () => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/utils/tempFiles`, {
        method: "DELETE",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const saveUserEventInfo = async (event, value) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/event-info/`, {
        method: "POST",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        },
        body: JSON.stringify({ event, value })
    });
}

export const deleteMediaFileInfoById = async (id) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/admin/stream/media-info/file/${id}`, {
        method: "DELETE",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const cleanMediaFileInfo = async () => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/admin/stream/media-info`, {
        method: "DELETE",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const renameFileApi = async (id, body) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/file-explorer/${id}/rename`, {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        },
        body: JSON.stringify(body)
    });
    return await response.json();
}

export const moveFileApi = async (id, body) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/file-explorer/${id}/move`, {
        method: "PUT",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        },
        body: JSON.stringify(body)
    });
    return await response.json();
}

export const deleteFileApi = async (id) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/file-explorer/${id}`, {
        method: "DELETE",
        headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}