import axios from 'axios'
const REACT_APP_BASEURL = process.env.REACT_APP_BASEURL;

export const login = async (email, password) => {
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
    return await axios.get(REACT_APP_BASEURL + "/api/user");

}

export const deleteUser = async (userId) => {
    const response = await fetch(`${REACT_APP_BASEURL}/api/user/${userId}`,{
        method: "DELETE",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    })
    return await response.json();
}

export const getAllUsers = async () => {
    let response = await fetch(REACT_APP_BASEURL + "/api/user/", {
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    })
    return response.json();
}

export const getUserRole = async (userId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/user/${userId}/role`, {
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

export const getUserDetailByUserId = async (userId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/user/${userId}`, {
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
    let response = await fetch(`${REACT_APP_BASEURL}/api/user/${userId}/role`, {
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
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/tmdb/${recordType}/search?q=${query}${!year || typeof(year)=="undefined" || year == "" ? "" : "&year="+year}`, {
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
    let response = await fetch(REACT_APP_BASEURL + "/api/cinema/record", {
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
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/record/${recordId}`, {
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

export const deleteDbCinemaRecord = async (recordId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/record/${recordId}`, {
        method: "DELETE",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    })
    return await response.json();
}

export const loadDbCinemaRecords = async (industry, type, recordsPageNumberList) => {

    var api = "";
    if (industry === "all") {
        // api = `${REACT_APP_BASEURL}/api/media/movie?industry=${filter.movieIndustry}&page=${recordsPageNumberList.all}`
        api = `${REACT_APP_BASEURL}/api/cinema/record/type/${type}?page=${recordsPageNumberList.all}&languages=all`
    }
    else if (industry === "bollywood") {
        // api = `${REACT_APP_BASEURL}/api/media/movie?industry=${filter.movieIndustry}&page=${recordsPageNumberList.bollywood}`
        api = `${REACT_APP_BASEURL}/api/cinema/record/type/${type}?page=${recordsPageNumberList.bollywood}&languages=hi`
    }
    else if (industry === "hollywood") {
        // api = `${REACT_APP_BASEURL}/api/media/movie?industry=${filter.movieIndustry}&page=${recordsPageNumberList.hollywood}`
        api = `${REACT_APP_BASEURL}/api/cinema/record/type/${type}?page=${recordsPageNumberList.hollywood}&languages=en`
    }
    else if (industry === "korean") {
        // api = `${REACT_APP_BASEURL}/api/media/movie?industry=${filter.movieIndustry}&page=${recordsPageNumberList.hollywood}`
        api = `${REACT_APP_BASEURL}/api/cinema/record/type/${type}?page=${recordsPageNumberList.korean}&languages=ko`
    }
    else if (industry === "south") {
        // api = `${REACT_APP_BASEURL}/api/media/movie?industry=${filter.movieIndustry}&page=${recordsPageNumberList.south}`
        api = `${REACT_APP_BASEURL}/api/cinema/record/type/${type}?page=${recordsPageNumberList.south}&languages=ta,te,ml,kn`
    }
    else if (industry === "gujarati") {
        // api = `${REACT_APP_BASEURL}/api/media/movie?industry=${filter.movieIndustry}&page=${recordsPageNumberList.gujarati}`
        api = `${REACT_APP_BASEURL}/api/cinema/record/type/${type}?page=${recordsPageNumberList.gujarati}&languages=gu`
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

export const searchRecord = async (query) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/record/search?q=${query}`, {
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
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/record/${recordId}/unwatchlist?userId=${userId}`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const watchedRecord = async (recordId, userId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/record/${recordId}/watched?userId=${userId}`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const unWatchedRecord = async (recordId, userId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/record/${recordId}/unwatched?userId=${userId}`, {
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
    let response = await fetch(`${REACT_APP_BASEURL}/api/stream/list?path=${path}`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const addCredential = async (userId, credential) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/user/${userId}/credential`, {
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

export const updateCredential = async (userId, credentialId, credential) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/user/${userId}/credential/${credentialId}`, {
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

export const getCredential = async (userId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/user/${userId}/credential`, {
        method: "GET",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const deleteCredentialByCredentialId = async (userId, pmId, credentialId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/user/${userId}/credential/${credentialId}?pmId=${pmId}`, {
        method: "DELETE",
        headers: {
            Authorization: 'Bearer ' + localStorage.getItem("token")
        }
    });
    return await response.json();
}

export const deleteHostById = async (userId, pmId) => {
    let response = await fetch(`${REACT_APP_BASEURL}/api/user/${userId}/pm/${pmId}`, {
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
    let response = await fetch(`${REACT_APP_BASEURL}/api/cinema/records/update`, {
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
