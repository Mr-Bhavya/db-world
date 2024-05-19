const columnDefs = [
    { headerName: 'No', field: 'no', pinned: "left", width: 60 },
    { headerName: 'ID', field: 'userId', width: 70 },
    { headerName: 'First Name', field: 'firstName' },
    { headerName: 'Last Name', field: 'lastName' },
    { headerName: 'DOB', field: 'dob' },
    { headerName: 'Age', field: 'age' },
    { headerName: 'Gender', field: 'gender' },
    { headerName: 'Mobile No', field: 'mobileNo' },
    { headerName: 'Email', field: 'email' },
    { headerName: 'Password', field: 'password' },
    { headerName: 'Login No', field: 'userAppData.noOfLogin' },
    { headerName: "Action", field: "action", minWidth: 150 },
    { headerName: 'User Role', field: 'userRole.name' },
    // {
    //     headerName: 'User Credential',
    //     children: [
    //         { headerName: 'Host', field: 'host' },
    //         { headerName: 'Credentials', field: 'credentials' },
    //     ],
    // },
    // {
    //     headerName: 'User Login Details',
    //     children: [
    //         { headerName: 'TimeStamp', field: 'timeStamp' },
    //         { headerName: 'UserAgent', field: 'userAgent' },
    //     ],
    // },

];

export default {
    columnDefs
}