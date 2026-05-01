//package com.db.dbworld.security.auth;
//
//import com.db.dbworld.core.user.entity.UserEntity;
//import com.db.dbworld.security.auth.userdetails.UserDetailImpl;
//import com.db.dbworld.core.user.service.UserService;
//import org.modelmapper.ModelMapper;
//import org.springframework.beans.factory.annotation.Autowired;
//import org.springframework.security.core.userdetails.UserDetails;
//import org.springframework.security.core.userdetails.UserDetailsService;
//import org.springframework.security.core.userdetails.UsernameNotFoundException;
//import org.springframework.security.crypto.password.PasswordEncoder;
//import org.springframework.stereotype.Service;
//
//@Service
//public class SecurityUserDetailsService implements UserDetailsService {
//
//    @Autowired
//    private UserService userService;
//
//    @Autowired
//    private PasswordEncoder passwordEncoder;
//
//    @Autowired
//    private ModelMapper modelMapper;
//
//    /**
//     * @param email
//     * @return
//     * @throws UsernameNotFoundException
//     */
//    @Override
//    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
//        UserEntity userEntity = this.userService.getUserEntityByEmail(email);
//        UserDetailImpl userDetails = this.modelMapper.map(userEntity, UserDetailImpl.class);
//        userDetails.setPassword(passwordEncoder.encode(userEntity.getPassword()));
//        return userDetails;
//    }
//}
