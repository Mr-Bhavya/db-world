const columnDefs = [
    // { headerName: 'No', field: 'no', width: 60 },
    {
        headerName: 'Persnoal Data',
        children: [
            { headerName: 'ID', field: 'userId', width: 70, columnGroupShow: 'closed' },
            { headerName: 'First Name', field: 'firstName', columnGroupShow: 'opened', pinned: "left", width: 100},
            { headerName: 'Last Name', field: 'lastName', columnGroupShow: 'closed' },
            { headerName: 'User Role', field: 'userRole.name', columnGroupShow: 'closed' },
            { headerName: 'DOB', field: 'dob', columnGroupShow: 'closed' },
            { headerName: 'Age', field: 'age', columnGroupShow: 'closed' },
            { headerName: 'Gender', field: 'gender', columnGroupShow: 'closed' },
            { headerName: 'Mobile No', field: 'mobileNo', columnGroupShow: 'closed' },
            { headerName: 'Email', field: 'email', columnGroupShow: 'closed' },
            { headerName: 'Password', field: 'password', columnGroupShow: 'closed' },
        ],
    },
    {
        headerName: 'App Data',
        children: [
            { headerName: 'Last Login', field: 'loginData.0.lastLoginDate' },
            { headerName: 'No Of Login', field: 'noOfLogin' },
        ],
    },
    // {
    //     headerName: 'Cinema Data',
    //     children: [
    //         { headerName: 'download_files', field: 'cinemaData.events.download_files.0' },
    //         { headerName: 'stream_files', field: 'cinemaData.events.stream_files.0' },
    //         { headerName: 'search_keywords', field: 'cinemaData.events.search_keywords' },
    //     ],
    // },
    { headerName: "Action", field: "action", minWidth: 150 },
];

export default {
    columnDefs
}